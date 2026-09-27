import { getAuthenticatedTelegramUser, upsertTelegramUser, jsonError } from '@/lib/telegram';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeLocale } from '@/lib/platform';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const user = await getAuthenticatedTelegramUser(request);
    await upsertTelegramUser(user);
    const body = await request.json();
    const locale = normalizeLocale(body?.locale);
    if (!locale) throw new Error('INVALID_LOCALE');
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('user_preferences').upsert({ telegram_id: user.id, locale, updated_at: new Date().toISOString() }, { onConflict: 'telegram_id' });
    if (error) throw error;
    return Response.json({ ok: true, locale });
  } catch (error) { return jsonError(error, 400); }
}
