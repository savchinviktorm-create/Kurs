import crypto from 'crypto';
import { getSupabaseAdmin } from './supabase';

export async function snapshotCourse(courseSlug, adminTelegramId, status = 'draft', label = null) {
  const sb = getSupabaseAdmin();
  const [course,locales,steps,stepLocales,blocks,spaces] = await Promise.all([
    sb.from('courses').select('*').eq('slug',courseSlug).single(),
    sb.from('course_locales').select('*').eq('course_slug',courseSlug),
    sb.from('course_steps').select('*').eq('course_slug',courseSlug).order('step_number'),
    sb.from('course_step_locales').select('*').eq('course_slug',courseSlug).order('step_number'),
    sb.from('course_step_blocks').select('*').eq('course_slug',courseSlug).order('step_number').order('sort_order'),
    sb.from('space_courses').select('*').eq('course_slug',courseSlug)
  ]);
  if(course.error) throw course.error;
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g,'').slice(0,14);
  const versionLabel = label || `edit-${stamp}-${crypto.randomBytes(2).toString('hex')}`;
  const manifest = { snapshot_format:'course-snapshot-v1', course:course.data, locales:locales.data||[], steps:steps.data||[], step_locales:stepLocales.data||[], blocks:blocks.data||[], spaces:spaces.data||[] };
  const {data,error}=await sb.from('course_versions').insert({course_slug:courseSlug,version_label:versionLabel,status,manifest,created_by:adminTelegramId,published_at:status==='published'?new Date().toISOString():null}).select('id,version_label,status,created_at').single();
  if(error) throw error; return data;
}

export async function restoreCourseSnapshot(courseSlug, versionId) {
  const sb=getSupabaseAdmin();
  const {data:v,error}=await sb.from('course_versions').select('*').eq('id',versionId).eq('course_slug',courseSlug).single(); if(error)throw error;
  const m=v.manifest||{}; if(m.snapshot_format!=='course-snapshot-v1') throw new Error('VERSION_NOT_RESTORABLE_SNAPSHOT');
  const course={...m.course}; delete course.created_at; delete course.slug; course.updated_at=new Date().toISOString();
  let r=await sb.from('courses').update(course).eq('slug',courseSlug);if(r.error)throw r.error;
  if(Array.isArray(m.locales))for(const x of m.locales){const row={...x};delete row.created_at;row.updated_at=new Date().toISOString();r=await sb.from('course_locales').upsert(row,{onConflict:'course_slug,locale'});if(r.error)throw r.error;}
  // Existing step identities are preserved; snapshot rows overwrite matching steps/locales/blocks.
  if(Array.isArray(m.steps))for(const x of m.steps){const row={...x};delete row.created_at;r=await sb.from('course_steps').upsert(row,{onConflict:'course_slug,step_number'});if(r.error)throw r.error;}
  if(Array.isArray(m.step_locales))for(const x of m.step_locales){const row={...x};delete row.created_at;row.updated_at=new Date().toISOString();r=await sb.from('course_step_locales').upsert(row,{onConflict:'course_slug,step_number,locale'});if(r.error)throw r.error;}
  await sb.from('course_step_blocks').delete().eq('course_slug',courseSlug);
  if(Array.isArray(m.blocks)&&m.blocks.length){const rows=m.blocks.map(x=>{const row={...x};delete row.id;delete row.created_at;delete row.updated_at;return row});r=await sb.from('course_step_blocks').insert(rows);if(r.error)throw r.error;}
  if(Array.isArray(m.spaces))for(const x of m.spaces){const row={...x};delete row.created_at;row.updated_at=new Date().toISOString();r=await sb.from('space_courses').upsert(row,{onConflict:'space_slug,course_slug'});if(r.error)throw r.error;}
  return v;
}
