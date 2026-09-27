import { requireAdmin, auditAdmin } from '@/lib/admin';
import { getSupabaseAdmin } from '@/lib/supabase';
import { jsonError } from '@/lib/telegram';

export const runtime='nodejs'; export const dynamic='force-dynamic';
const cleanSlug = v => String(v||'').toLowerCase().trim().replace(/[^a-z0-9-]+/g,'-').replace(/^-|-$/g,'');

export async function GET(request){
  try{
    await requireAdmin(request,'analyst'); const sb=getSupabaseAdmin();
    const {data,error}=await sb.from('courses').select('*,course_locales(locale,title,short_title,is_published),space_courses(space_slug,is_visible,price_override_stars,access_override)').order('sort_order',{ascending:true});
    if(error) throw error; return Response.json({ok:true,courses:data||[]});
  }catch(e){return jsonError(e,403)}
}

export async function POST(request){
  try{
    const {admin}=await requireAdmin(request,'editor'); const body=await request.json(); const sb=getSupabaseAdmin();
    const slug=cleanSlug(body.slug||body.short_title||body.title); if(!slug) throw new Error('INVALID_SLUG');
    const locale=body.locale||'uk';
    const row={ slug,title:body.title||slug,short_title:body.short_title||body.title||slug,intro_text:body.intro_text||'',description:body.description||null,total_steps:1,timezone:body.timezone||'Europe/Kyiv',unlock_hour:Number(body.unlock_hour??11),restart_offer_after_missed_days:Number(body.restart_offer_after_missed_days??5),is_free:body.is_free!==false,one_time_price_stars:body.is_free!==false?null:Number(body.one_time_price_stars||99),included_in_subscription:body.included_in_subscription!==false,is_published:false,sort_order:Number(body.sort_order||100),first_step_immediate:body.first_step_immediate!==false,default_locale:locale,available_locales:[locale],protection_level:body.protection_level||'standard',updated_at:new Date().toISOString() };
    const {error}=await sb.from('courses').insert(row); if(error) throw error;
    await sb.from('course_steps').insert({course_slug:slug,step_number:1,title:body.first_step_title||'Крок 1',content:''});
    await sb.from('course_locales').insert({course_slug:slug,locale,title:row.title,short_title:row.short_title,description:row.description,intro_text:row.intro_text,is_published:true});
    await sb.from('course_step_locales').insert({course_slug:slug,step_number:1,locale,title:body.first_step_title||'Крок 1',content:''});
    if(body.space_slug) await sb.from('space_courses').upsert({space_slug:body.space_slug,course_slug:slug,is_visible:false,sort_order:row.sort_order},{onConflict:'space_slug,course_slug'});
    await auditAdmin(admin.telegram_id,'course.create','course',slug,{title:row.title});
    return Response.json({ok:true,slug});
  }catch(e){return jsonError(e,400)}
}
