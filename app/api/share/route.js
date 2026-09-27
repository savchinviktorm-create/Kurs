import crypto from 'crypto';
import { getAuthenticatedTelegramUser, jsonError } from '@/lib/telegram';
import { getSupabaseAdmin } from '@/lib/supabase';
import { encodeStartParam } from '@/lib/platform';
import { TELEGRAM_BOT_USERNAME, TELEGRAM_MINIAPP_SHORT_NAME } from '@/lib/env';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const user = await getAuthenticatedTelegramUser(request);
    const body = await request.json();
    const spaceSlug = String(body.space_slug || 'pkk');
    const courseSlug = String(body.course_slug || '');
    const stepNumber = body.step_number ? Number(body.step_number) : null;
    if (!courseSlug) throw new Error('COURSE_REQUIRED');
    const supabase = getSupabaseAdmin();
    const { data: link } = await supabase.from('space_courses').select('course_slug').eq('space_slug', spaceSlug).eq('course_slug', courseSlug).eq('is_visible', true).maybeSingle();
    if (!link) throw new Error('COURSE_NOT_SHAREABLE');
    const shareCode = crypto.randomBytes(8).toString('hex');
    await supabase.from('share_events').insert({ telegram_id: user.id, space_slug: spaceSlug, course_slug: courseSlug, step_number: stepNumber, share_code: shareCode });
    const startapp = encodeStartParam({ space_slug: spaceSlug, course_slug: courseSlug, step_number: stepNumber, ref: shareCode });
    const direct = `https://t.me/${TELEGRAM_BOT_USERNAME}/${TELEGRAM_MINIAPP_SHORT_NAME}?startapp=${encodeURIComponent(startapp)}`;
    return Response.json({ ok: true, url: direct, share_code: shareCode });
  } catch (error) { return jsonError(error, 400); }
}
