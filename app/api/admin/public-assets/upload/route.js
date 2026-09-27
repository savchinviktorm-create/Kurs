import crypto from 'crypto';
import { requireAdmin, auditAdmin } from '@/lib/admin';
import { getSupabaseAdmin } from '@/lib/supabase';
import { jsonError } from '@/lib/telegram';

export const runtime = 'nodejs';

const extFor = (name='asset') => {
  const m = name.match(/(\.[a-z0-9]{1,8})$/i);
  return m ? m[1].toLowerCase() : '';
};

export async function POST(request) {
  try {
    const { admin } = await requireAdmin(request, 'editor');
    const fd = await request.formData();
    const file = fd.get('file');
    const kind = String(fd.get('kind') || 'brand');
    if (!file || typeof file === 'string') throw new Error('FILE_REQUIRED');
    if (!String(file.type || '').startsWith('image/')) throw new Error('IMAGE_REQUIRED');
    if (file.size > 6_000_000) throw new Error('BRAND_IMAGE_TOO_LARGE');

    const sb = getSupabaseAdmin();
    const key = `${kind}/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}${extFor(file.name)}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    const { error: upError } = await sb.storage.from('course-public').upload(key, bytes, {
      contentType: file.type || 'application/octet-stream',
      upsert: false
    });
    if (upError) throw upError;
    const { data } = sb.storage.from('course-public').getPublicUrl(key);
    await auditAdmin(admin.telegram_id, 'public_asset.upload', 'storage', key, { kind, size: file.size });
    return Response.json({ ok: true, path: key, url: data.publicUrl });
  } catch (e) { return jsonError(e, 400); }
}
