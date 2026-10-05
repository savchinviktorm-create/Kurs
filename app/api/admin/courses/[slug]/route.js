import { requireAdmin, auditAdmin } from '@/lib/admin';
import { getSupabaseAdmin } from '@/lib/supabase';
import { jsonError } from '@/lib/telegram';
import { snapshotCourse } from '@/lib/course-revisions';

export const runtime='nodejs'; export const dynamic='force-dynamic';
export async function GET(request,{params}){
  try{await requireAdmin(request,'analyst'); const {slug}=await params; const sb=getSupabaseAdmin();
    const [course,locales,steps,spaces,versions]=await Promise.all([
      sb.from('courses').select('*').eq('slug',slug).single(),
      sb.from('course_locales').select('*').eq('course_slug',slug).order('locale'),
      sb.from('course_steps').select('step_number,title,content,course_step_locales(locale,title,content)').eq('course_slug',slug).order('step_number'),
      sb.from('space_courses').select('*,spaces(slug,title,short_title)').eq('course_slug',slug),
      sb.from('course_versions').select('id,version_label,status,created_by,published_at,created_at').eq('course_slug',slug).order('created_at',{ascending:false}).limit(30)
    ]); if(course.error) throw course.error; if(locales.error) throw locales.error; if(steps.error) throw steps.error; if(spaces.error) throw spaces.error; if(versions.error) throw versions.error;
    return Response.json({ok:true,course:course.data,locales:locales.data||[],steps:steps.data||[],spaces:spaces.data||[],versions:versions.data||[]});
  }catch(e){return jsonError(e,404)}
}
export async function PUT(request,{params}){
  try{const {admin}=await requireAdmin(request,'editor'); const {slug}=await params; const body=await request.json(); const sb=getSupabaseAdmin();
    const allowed=['title','short_title','description','intro_text','logo_path','cover_path','timezone','unlock_hour','restart_offer_after_missed_days','is_free','one_time_price_stars','included_in_subscription','is_published','sort_order','first_step_immediate','allow_previous_steps','max_steps_per_day','default_locale','available_locales','protection_level','settings','trial_enabled','trial_days','trial_max_steps','certificate_enabled','certificate_settings'];
    const patch={updated_at:new Date().toISOString()}; for(const k of allowed) if(Object.prototype.hasOwnProperty.call(body,k)) patch[k]=body[k];
    if(patch.is_free===true) patch.one_time_price_stars=null;
    const {error}=await sb.from('courses').update(patch).eq('slug',slug); if(error) throw error;
    if(Array.isArray(body.locales)) for(const l of body.locales){ if(!l?.locale) continue; const {error:e}=await sb.from('course_locales').upsert({course_slug:slug,locale:l.locale,title:l.title||body.title||slug,short_title:l.short_title||l.title||slug,description:l.description||null,intro_text:l.intro_text||'',logo_path:l.logo_path||null,cover_path:l.cover_path||null,is_published:l.is_published!==false,updated_at:new Date().toISOString()},{onConflict:'course_slug,locale'}); if(e) throw e; }
    if(Array.isArray(body.space_assignments)) for(const a of body.space_assignments){ if(!a?.space_slug) continue; const {error:e}=await sb.from('space_courses').upsert({space_slug:a.space_slug,course_slug:slug,is_visible:a.is_visible!==false,sort_order:Number(a.sort_order||100),price_override_stars:a.price_override_stars?Number(a.price_override_stars):null,access_override:a.access_override||null,included_in_subscription_override:a.included_in_subscription_override==null?null:Boolean(a.included_in_subscription_override),updated_at:new Date().toISOString()},{onConflict:'space_slug,course_slug'}); if(e) throw e; }
    await snapshotCourse(slug,admin.telegram_id,patch.is_published===true?'published':'draft');
    await auditAdmin(admin.telegram_id,'course.update','course',slug,{fields:Object.keys(patch)}); return Response.json({ok:true});
  }catch(e){return jsonError(e,400)}
}
export async function DELETE(request,{params}){
  try{const {admin}=await requireAdmin(request,'admin'); const {slug}=await params; const sb=getSupabaseAdmin(); const {error}=await sb.from('courses').update({is_published:false,updated_at:new Date().toISOString()}).eq('slug',slug); if(error) throw error; await auditAdmin(admin.telegram_id,'course.archive','course',slug); return Response.json({ok:true});}catch(e){return jsonError(e,400)}
}
