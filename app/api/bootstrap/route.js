import { getAuthenticatedTelegramContext, upsertTelegramUser, jsonError } from '@/lib/telegram';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasCourseAccess, getSubscriptionState, effectiveCourseConfig } from '@/lib/access';
import { resolveSpace, resolveUserLocale, getLocalizedSpace, localizeCourse, getAppSetting } from '@/lib/platform';
import { ALL_ACCESS_SUBSCRIPTION_STARS, DEFAULT_COURSE_PRICE_STARS, TELEGRAM_BOT_USERNAME, TELEGRAM_MINIAPP_SHORT_NAME } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const context = await getAuthenticatedTelegramContext(request);
    const user = context.user;
    await upsertTelegramUser(user);
    const supabase = getSupabaseAdmin();
    const { space, entry } = await resolveSpace({ request, startParam: context.start_param });
    const requestedLocale = new URL(request.url).searchParams.get('lang');
    const locale = await resolveUserLocale(user.id, user.language_code, space, requestedLocale);
    const localizedSpace = await getLocalizedSpace(space, locale);

    if (entry?.ref) {
      try {
        const { data: share } = await supabase.from('share_events').select('id,opened_count').eq('share_code', entry.ref).maybeSingle();
        if (share) await supabase.from('share_events').update({ opened_count: Number(share.opened_count || 0) + 1 }).eq('id', share.id);
      } catch {}
    }

    await supabase.from('user_preferences').upsert({
      telegram_id: user.id,
      locale,
      last_space_slug: space.slug,
      updated_at: new Date().toISOString()
    }, { onConflict: 'telegram_id' });

    const { data: links, error: linksError } = await supabase
      .from('space_courses')
      .select('*')
      .eq('space_slug', space.slug)
      .eq('is_visible', true)
      .order('sort_order', { ascending: true });
    if (linksError) throw linksError;

    const enriched = [];
    for (const link of links || []) {
      const { data: baseCourse, error } = await supabase
        .from('courses')
        .select('*')
        .eq('slug', link.course_slug)
        .eq('is_published', true)
        .maybeSingle();
      if (error) throw error;
      if (!baseCourse) continue;

      const course = await localizeCourse(baseCourse, locale, space.default_locale || 'uk');
      if (space.locale_policy === 'hide_missing' && !course.has_requested_locale) continue;
      const effective = effectiveCourseConfig(course, link);
      const access = await hasCourseAccess(user.id, course, link);
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
      enriched.push({
        ...course,
        ...effective,
        access,
        attempt,
        space_sort_order: link.sort_order
      });
    }

    const subscription = await getSubscriptionState(user.id);
    const { data: plan } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('plan_key', space.subscription_plan_key || 'all-access')
      .eq('is_enabled', true)
      .maybeSingle();

    const { data: admin } = await supabase.from('admin_users').select('role,enabled').eq('telegram_id', user.id).maybeSingle();
    const donationOptions = await getAppSetting('donation_options', [10,25,50,100]);
    const hasPaidCourses = enriched.some(c => !c.is_free);

    return Response.json({
      ok: true,
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name || null,
        username: user.username || null,
        photo_url: user.photo_url || null
      },
      is_admin: Boolean(admin?.enabled),
      admin_role: admin?.enabled ? admin.role : null,
      locale,
      available_locales: space.allowed_locales || ['uk'],
      space: localizedSpace,
      entry,
      courses: enriched,
      subscription,
      has_paid_courses: hasPaidCourses,
      prices: {
        all_access_subscription_stars: plan?.price_stars || ALL_ACCESS_SUBSCRIPTION_STARS,
        subscription_plan_key: plan?.plan_key || 'all-access',
        subscription_period_seconds: plan?.period_seconds || 2592000,
        default_course_stars: DEFAULT_COURSE_PRICE_STARS,
        donation_options: Array.isArray(donationOptions) ? donationOptions : [10,25,50,100]
      },
      telegram: {
        bot_username: TELEGRAM_BOT_USERNAME,
        mini_app_short_name: TELEGRAM_MINIAPP_SHORT_NAME,
        direct_link: `https://t.me/${TELEGRAM_BOT_USERNAME}/${TELEGRAM_MINIAPP_SHORT_NAME}`
      }
    });
  } catch (error) {
    return jsonError(error, 401);
  }
}
