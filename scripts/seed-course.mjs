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
const { error: courseError } = await supabase.from('courses').upsert({
  slug: course.slug,
  title: course.title,
  short_title: course.short_title,
  intro_text: course.intro_text,
  logo_path: course.logo_path,
  total_steps: course.total_steps,
  timezone: course.timezone,
  unlock_hour: course.unlock_hour,
  restart_offer_after_missed_days: course.restart_offer_after_missed_days,
  is_free: course.is_free,
  one_time_price_stars: course.one_time_price_stars,
  is_published: true,
  sort_order: 10,
  source_sha256: course.source_sha256,
  updated_at: new Date().toISOString()
}, { onConflict: 'slug' });
if (courseError) throw courseError;

const rows = steps.map((s) => ({ course_slug: course.slug, ...s }));
const { error: stepError } = await supabase.from('course_steps').upsert(rows, { onConflict: 'course_slug,step_number' });
if (stepError) throw stepError;

console.log(`Seeded ${course.title}: ${rows.length} steps.`);
