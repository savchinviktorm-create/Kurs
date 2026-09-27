import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'content', 'technology-changes.json'), 'utf8'));
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before npm run seed');

const supabase = createClient(url, key, { auth: { persistSession: false } });
const { steps, ...course } = data;
const row = {
  slug: course.slug,
  title: course.title,
  short_title: course.short_title,
  intro_text: course.intro_text,
  description: course.description || '91 крок до більш свідомого управління увагою, рішеннями та станом.',
  logo_path: course.logo_path,
  total_steps: course.total_steps,
  timezone: course.timezone,
  unlock_hour: course.unlock_hour,
  restart_offer_after_missed_days: course.restart_offer_after_missed_days,
  is_free: course.is_free,
  one_time_price_stars: course.one_time_price_stars,
  included_in_subscription: true,
  first_step_immediate: true,
  default_locale: 'uk',
  available_locales: ['uk'],
  protection_level: 'standard',
  is_published: true,
  sort_order: 10,
  source_sha256: course.source_sha256,
  updated_at: new Date().toISOString()
};
let res = await supabase.from('courses').upsert(row, { onConflict: 'slug' });
if (res.error) throw res.error;

const rows = steps.map(s => ({ course_slug: course.slug, ...s }));
res = await supabase.from('course_steps').upsert(rows, { onConflict: 'course_slug,step_number' });
if (res.error) throw res.error;

res = await supabase.from('course_locales').upsert({
  course_slug: course.slug, locale: 'uk', title: course.title, short_title: course.short_title,
  intro_text: course.intro_text, logo_path: course.logo_path, is_published: true, updated_at: new Date().toISOString()
}, { onConflict: 'course_slug,locale' });
if (res.error) throw res.error;

res = await supabase.from('course_step_locales').upsert(rows.map(s => ({ ...s, locale: 'uk', updated_at: new Date().toISOString() })), { onConflict: 'course_slug,step_number,locale' });
if (res.error) throw res.error;

await supabase.from('space_courses').upsert({ space_slug: 'pkk', course_slug: course.slug, is_visible: true, sort_order: 10 }, { onConflict: 'space_slug,course_slug' });
console.log(`Seeded ${course.title}: ${rows.length} steps; Ukrainian source preserved; first step immediate.`);
