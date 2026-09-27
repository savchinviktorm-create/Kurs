import { getSupabaseAdmin } from './supabase';

export function decodeStartParam(value = '') {
  if (!value) return {};
  if (value.startsWith('space-')) return { space_slug: value.slice(6) };
  if (value.startsWith('x_')) {
    try {
      const json = Buffer.from(value.slice(2), 'base64url').toString('utf8');
      const parsed = JSON.parse(json);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch { return {}; }
  }
  return {};
}

export function encodeStartParam(payload) {
  return `x_${Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')}`;
}

export async function getAppSetting(key, fallback = null) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('app_settings').select('value').eq('key', key).maybeSingle();
  if (error) throw error;
  return data?.value ?? fallback;
}

export async function resolveSpace({ request, startParam }) {
  const supabase = getSupabaseAdmin();
  const url = new URL(request.url);
  const explicit = url.searchParams.get('space') || request.headers.get('x-app-space');
  const decoded = decodeStartParam(startParam || '');
  let slug = explicit || decoded.space_slug;
  if (!slug) slug = await getAppSetting('default_space_slug', 'pkk');

  let { data: space, error } = await supabase.from('spaces').select('*').eq('slug', slug).eq('is_published', true).maybeSingle();
  if (error) throw error;
  if (!space) {
    const fallback = await getAppSetting('default_space_slug', 'pkk');
    const res = await supabase.from('spaces').select('*').eq('slug', fallback).eq('is_published', true).maybeSingle();
    if (res.error) throw res.error;
    space = res.data;
  }
  if (!space) throw new Error('SPACE_NOT_FOUND');
  return { space, entry: decoded };
}

export function normalizeLocale(value) {
  const code = String(value || '').toLowerCase().replace('_','-').split('-')[0];
  return ['uk','ru','en'].includes(code) ? code : null;
}

export async function resolveUserLocale(telegramId, telegramLanguage, space, requestedLocale) {
  const supabase = getSupabaseAdmin();
  const allowed = space.allowed_locales || [space.default_locale || 'uk'];
  const requested = normalizeLocale(requestedLocale);
  if (requested && allowed.includes(requested)) return requested;

  const { data } = await supabase.from('user_preferences').select('locale').eq('telegram_id', telegramId).maybeSingle();
  const preferred = normalizeLocale(data?.locale);
  if (preferred && allowed.includes(preferred)) return preferred;

  const tg = normalizeLocale(telegramLanguage);
  if (tg && allowed.includes(tg)) return tg;
  return allowed.includes(space.default_locale) ? space.default_locale : allowed[0] || 'uk';
}

export async function getLocalizedSpace(space, locale) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from('space_locales').select('*').eq('space_slug', space.slug).eq('locale', locale).maybeSingle();
  return {
    ...space,
    title: data?.title || space.title,
    short_title: data?.short_title || space.short_title,
    description: data?.description ?? space.description,
    hero_text: data?.hero_text || null
  };
}

export async function localizeCourse(course, locale, fallbackLocale = 'uk') {
  const supabase = getSupabaseAdmin();
  const { data: exact } = await supabase.from('course_locales').select('*').eq('course_slug', course.slug).eq('locale', locale).eq('is_published', true).maybeSingle();
  let loc = exact;
  if (!loc && fallbackLocale && fallbackLocale !== locale) {
    const { data } = await supabase.from('course_locales').select('*').eq('course_slug', course.slug).eq('locale', fallbackLocale).eq('is_published', true).maybeSingle();
    loc = data;
  }
  return {
    ...course,
    title: loc?.title || course.title,
    short_title: loc?.short_title || course.short_title,
    description: loc?.description ?? course.description,
    intro_text: loc?.intro_text || course.intro_text,
    logo_path: loc?.logo_path || course.logo_path,
    cover_path: loc?.cover_path || course.cover_path,
    resolved_locale: loc?.locale || course.default_locale || fallbackLocale,
    has_requested_locale: Boolean(exact)
  };
}

export async function localizeStep(courseSlug, stepNumber, locale, fallbackLocale = 'uk') {
  const supabase = getSupabaseAdmin();
  const { data: base, error } = await supabase.from('course_steps').select('step_number,title,content').eq('course_slug', courseSlug).eq('step_number', stepNumber).maybeSingle();
  if (error) throw error;
  if (!base) return null;
  const { data: exact } = await supabase.from('course_step_locales').select('locale,title,content').eq('course_slug', courseSlug).eq('step_number', stepNumber).eq('locale', locale).maybeSingle();
  let loc = exact;
  if (!loc && fallbackLocale && fallbackLocale !== locale) {
    const { data } = await supabase.from('course_step_locales').select('locale,title,content').eq('course_slug', courseSlug).eq('step_number', stepNumber).eq('locale', fallbackLocale).maybeSingle();
    loc = data;
  }
  return { ...base, title: loc?.title || base.title, content: loc?.content || base.content, resolved_locale: loc?.locale || fallbackLocale };
}

export function courseRequestOptions(request) {
  const url = new URL(request.url);
  return {
    spaceSlug: url.searchParams.get('space') || request.headers.get('x-app-space') || 'pkk',
    locale: normalizeLocale(url.searchParams.get('lang') || request.headers.get('x-app-locale')) || 'uk'
  };
}
