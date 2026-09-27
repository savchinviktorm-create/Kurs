import { requireAdmin, auditAdmin } from '@/lib/admin';
import { getSupabaseAdmin } from '@/lib/supabase';
import { jsonError } from '@/lib/telegram';
export const runtime='nodejs';
export async function GET(request){try{await requireAdmin(request,'admin');const sb=getSupabaseAdmin();const{data,error}=await sb.from('admin_users').select('*').order('role');if(error)throw error;return Response.json({ok:true,admins:data||[]});}catch(e){return jsonError(e,403)}}
export async function POST(request){try{const{admin}=await requireAdmin(request,'owner');const b=await request.json();const id=Number(b.telegram_id);if(!id)throw new Error('INVALID_TELEGRAM_ID');const sb=getSupabaseAdmin();const{error}=await sb.from('admin_users').upsert({telegram_id:id,role:b.role||'editor',permissions:b.permissions||{},enabled:b.enabled!==false,label:b.label||null,updated_at:new Date().toISOString()},{onConflict:'telegram_id'});if(error)throw error;await auditAdmin(admin.telegram_id,'admin.upsert','admin_user',id,{role:b.role});return Response.json({ok:true});}catch(e){return jsonError(e,400)}}
