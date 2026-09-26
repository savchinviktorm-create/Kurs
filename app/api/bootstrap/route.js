import { getAuthenticatedTelegramUser, upsertTelegramUser, jsonError } from '@/lib/telegram';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasCourseAccess, getSubscriptionState } from '@/lib/access';
import { ALL_ACCESS_SUBSCRIPTION_STARS, DEFAULT_COURSE_PRICE_STARS } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const user = await getAuthenticatedTelegramUser(request);
    await upsertTelegramUser(user);
    const supabase = getSupabaseAdmin();

    const { data: courses, error } = await supabase
      .from('courses')
      .select('slug,title,short_title,logo_path,total_steps,is_free,one_time_price_stars,sort_order')
      .eq('is_published', true)
      .order('sort_order', { ascending: true });
    if (error) throw error;

    const enriched = [];
    for (const course of courses || []) {
      const access = await hasCourseAccess(user.id, course);
      const { data: attempt, error: attemptError } = await supabase
        .from('course_attempts')
        .select('status,completed_steps,current_step,next_unlock_at,finished_at')
        .eq('telegram_id', user.id)
        .eq('course_slug', course.slug)
        .in('status', ['active', 'finished'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (attemptError) throw attemptError;
      enriched.push({ ...course, access, attempt });
    }

    const subscription = await getSubscriptionState(user.id);

    return Response.json({
      ok: true,
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name || null,
        username: user.username || null,
        photo_url: user.photo_url || null
      },
      courses: enriched,
      subscription,
      prices: {
        all_access_subscription_stars: ALL_ACCESS_SUBSCRIPTION_STARS,
        default_course_stars: DEFAULT_COURSE_PRICE_STARS,
        donation_options: [10, 25, 50, 100]
      }
    });
  } catch (error) {
    return jsonError(error, 401);
  }
}
