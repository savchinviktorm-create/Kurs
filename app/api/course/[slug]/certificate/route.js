import crypto from 'crypto';
import { getAuthenticatedTelegramUser, upsertTelegramUser, jsonError } from '@/lib/telegram';
import { getSupabaseAdmin } from '@/lib/supabase';
import { courseRequestOptions, getLocalizedSpace, localizeCourse } from '@/lib/platform';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cleanFullName(value) {
  const name = String(value || '').replace(/\s+/g, ' ').trim();
  if (name.length < 3 || name.length > 160 || !/\p{L}/u.test(name) || /[<>\n\r{}]/.test(name)) throw new Error('INVALID_CERTIFICATE_NAME');
  return name;
}

function certificateNumber() {
  return `PPC-${new Date().getFullYear()}-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
}

async function contextFor(userId, slug, opts) {
  const sb = getSupabaseAdmin();
  const { data: baseCourse, error: courseError } = await sb.from('courses').select('*').eq('slug', slug).eq('is_published', true).maybeSingle();
  if (courseError) throw courseError;
  if (!baseCourse) throw new Error('COURSE_NOT_FOUND');
  if (!baseCourse.certificate_enabled) throw new Error('CERTIFICATE_DISABLED');

  const { data: attempt, error: attemptError } = await sb.from('course_attempts')
    .select('*').eq('telegram_id', userId).eq('course_slug', slug).eq('status', 'finished')
    .order('finished_at', { ascending: false }).limit(1).maybeSingle();
  if (attemptError) throw attemptError;
  if (!attempt) throw new Error('COURSE_NOT_FINISHED');

  const { data: baseSpace, error: spaceError } = await sb.from('spaces').select('*').eq('slug', opts.spaceSlug).maybeSingle();
  if (spaceError) throw spaceError;
  const space = baseSpace ? await getLocalizedSpace(baseSpace, opts.locale) : null;
  const course = await localizeCourse(baseCourse, opts.locale, baseSpace?.default_locale || 'uk');
  return { sb, course, attempt, space };
}

export async function GET(request, { params }) {
  try {
    const user = await getAuthenticatedTelegramUser(request);
    await upsertTelegramUser(user);
    const { slug } = await params;
    const opts = courseRequestOptions(request);
    const { sb, course, attempt, space } = await contextFor(user.id, slug, opts);
    const { data, error } = await sb.from('course_certificates')
      .select('id,certificate_number,verification_code,full_name,course_title_snapshot,brand_title_snapshot,locale,completed_at,issued_at,status,space_slug,metadata')
      .eq('attempt_id', attempt.id).maybeSingle();
    if (error) throw error;
    return Response.json({ ok: true, certificate: data || null, course, space });
  } catch (error) {
    return jsonError(error, 400);
  }
}

export async function POST(request, { params }) {
  try {
    const user = await getAuthenticatedTelegramUser(request);
    await upsertTelegramUser(user);
    const { slug } = await params;
    const opts = courseRequestOptions(request);
    const body = await request.json();
    const fullName = cleanFullName(body?.full_name);
    const { sb, course, attempt, space } = await contextFor(user.id, slug, opts);
    const brandTitle = space?.title || 'Простір практичного контенту';
    const settings = course.certificate_settings || {};

    const { data: existing, error: existingError } = await sb.from('course_certificates')
      .select('*').eq('attempt_id', attempt.id).maybeSingle();
    if (existingError) throw existingError;

    let row;
    if (existing) {
      const { data, error } = await sb.from('course_certificates').update({
        full_name: fullName,
        course_title_snapshot: course.title,
        brand_title_snapshot: brandTitle,
        locale: opts.locale,
        space_slug: space?.slug || null,
        metadata: {
          ...(existing.metadata || {}),
          subtitle: settings.subtitle || 'Сертифікат про завершення курсу',
          signatory_name: settings.signatory_name || '',
          signatory_title: settings.signatory_title || '',
          verification_enabled: settings.verification_enabled !== false,
          space_logo_path: space?.logo_path || null,
          accent_color: space?.theme?.accent_color || '#B9822F'
        },
        updated_at: new Date().toISOString()
      }).eq('id', existing.id).select('*').single();
      if (error) throw error;
      row = data;
    } else {
      const { data, error } = await sb.from('course_certificates').insert({
        certificate_number: certificateNumber(),
        verification_code: crypto.randomBytes(18).toString('base64url'),
        telegram_id: user.id,
        course_slug: slug,
        attempt_id: attempt.id,
        space_slug: space?.slug || null,
        full_name: fullName,
        course_title_snapshot: course.title,
        brand_title_snapshot: brandTitle,
        locale: opts.locale,
        completed_at: attempt.finished_at || new Date().toISOString(),
        metadata: {
          subtitle: settings.subtitle || 'Сертифікат про завершення курсу',
          signatory_name: settings.signatory_name || '',
          signatory_title: settings.signatory_title || '',
          verification_enabled: settings.verification_enabled !== false,
          space_logo_path: space?.logo_path || null,
          accent_color: space?.theme?.accent_color || '#B9822F'
        }
      }).select('*').single();
      if (error) throw error;
      row = data;
    }

    return Response.json({ ok: true, certificate: row, course, space });
  } catch (error) {
    return jsonError(error, 400);
  }
}
