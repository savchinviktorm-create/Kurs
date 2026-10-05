import { getAuthenticatedTelegramUser, upsertTelegramUser, jsonError } from '@/lib/telegram';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCourseAccessState, effectiveCourseConfig } from '@/lib/access';
import { courseRequestOptions } from '@/lib/platform';

export const runtime = 'nodejs';

export async function POST(request, { params }) {
  try {
    const user = await getAuthenticatedTelegramUser(request);
    await upsertTelegramUser(user);
    const { slug } = await params;
    const opts = courseRequestOptions(request);
    const supabase = getSupabaseAdmin();

    const { data: course, error: courseError } = await supabase
      .from('courses').select('*').eq('slug', slug).eq('is_published', true).maybeSingle();
    if (courseError) throw courseError;
    if (!course) throw new Error('COURSE_NOT_FOUND');

    const { data: link, error: linkError } = await supabase
      .from('space_courses').select('*').eq('space_slug', opts.spaceSlug).eq('course_slug', slug).eq('is_visible', true).maybeSingle();
    if (linkError) throw linkError;
    if (!link) throw new Error('COURSE_NOT_IN_SPACE');

    const cfg = effectiveCourseConfig(course, link);
    if (cfg.is_free) throw new Error('TRIAL_NOT_REQUIRED');
    if (!course.trial_enabled) throw new Error('TRIAL_DISABLED');

    const current = await getCourseAccessState(user.id, course, link);
    if (current.mode === 'permanent' || current.mode === 'subscription') throw new Error('ACCESS_ALREADY_ACTIVE');
    if (current.mode === 'trial') return Response.json({ ok: true, trial: current.trial });
    if (!current.trial?.eligible) throw new Error('TRIAL_ALREADY_USED');

    const days = Math.max(1, Math.min(365, Number(course.trial_days || 3)));
    const started = new Date();
    const ends = new Date(started.getTime() + days * 24 * 60 * 60 * 1000);
    const maxSteps = course.trial_max_steps == null ? null : Math.max(1, Number(course.trial_max_steps));

    const { data: trial, error: insertError } = await supabase.from('course_trials').insert({
      telegram_id: user.id,
      course_slug: slug,
      source_space_slug: opts.spaceSlug,
      status: 'active',
      started_at: started.toISOString(),
      ends_at: ends.toISOString(),
      max_steps: maxSteps,
      updated_at: started.toISOString()
    }).select('id,status,started_at,ends_at,max_steps').single();
    if (insertError) {
      if (String(insertError.code) === '23505') throw new Error('TRIAL_ALREADY_USED');
      throw insertError;
    }

    return Response.json({ ok: true, trial });
  } catch (error) {
    return jsonError(error, 400);
  }
}
