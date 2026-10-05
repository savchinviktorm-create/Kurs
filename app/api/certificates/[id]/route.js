import { getAuthenticatedTelegramUser, upsertTelegramUser, jsonError } from '@/lib/telegram';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const user = await getAuthenticatedTelegramUser(request);
    await upsertTelegramUser(user);
    const { id } = await params;
    const sb = getSupabaseAdmin();
    const { data: certificate, error } = await sb.from('course_certificates')
      .select('id,certificate_number,verification_code,full_name,course_slug,course_title_snapshot,brand_title_snapshot,locale,completed_at,issued_at,status,space_slug,metadata')
      .eq('id', id)
      .eq('telegram_id', user.id)
      .eq('status', 'issued')
      .maybeSingle();
    if (error) throw error;
    if (!certificate) throw new Error('CERTIFICATE_NOT_FOUND');
    return Response.json({ ok: true, certificate });
  } catch (error) {
    return jsonError(error, 404);
  }
}
