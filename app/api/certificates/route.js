import { getAuthenticatedTelegramUser, upsertTelegramUser, jsonError } from '@/lib/telegram';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const user = await getAuthenticatedTelegramUser(request);
    await upsertTelegramUser(user);
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from('course_certificates')
      .select('id,certificate_number,verification_code,full_name,course_slug,course_title_snapshot,brand_title_snapshot,completed_at,issued_at,status,space_slug,metadata')
      .eq('telegram_id', user.id)
      .eq('status', 'issued')
      .order('issued_at', { ascending: false });
    if (error) throw error;
    return Response.json({ ok: true, certificates: data || [] });
  } catch (error) {
    return jsonError(error, 401);
  }
}
