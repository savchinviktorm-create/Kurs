import { requireAdmin } from '@/lib/admin';
import { getSupabaseAdmin } from '@/lib/supabase';
import { jsonError } from '@/lib/telegram';
export const runtime='nodejs'; export const dynamic='force-dynamic';
export async function GET(request){try{await requireAdmin(request,'analyst');const sb=getSupabaseAdmin();const{data,error}=await sb.from('share_events').select('*,users(first_name,username)').order('created_at',{ascending:false}).limit(500);if(error)throw error;return Response.json({ok:true,shares:data||[]});}catch(e){return jsonError(e,403)}}
