import { requireAdmin, auditAdmin } from '@/lib/admin';
import { getSupabaseAdmin } from '@/lib/supabase';
import { jsonError } from '@/lib/telegram';
export const runtime='nodejs';
export async function PUT(request,{params}){try{const{admin}=await requireAdmin(request,'admin');const{key}=await params;const b=await request.json();const sb=getSupabaseAdmin();const allowed=['display_name','provider_type','delivery_type','config','secret_env_prefix','is_enabled','sort_order'];const patch={updated_at:new Date().toISOString()};for(const k of allowed)if(Object.prototype.hasOwnProperty.call(b,k))patch[k]=b[k];const{error}=await sb.from('media_providers').update(patch).eq('provider_key',key);if(error)throw error;await auditAdmin(admin.telegram_id,'provider.update','media_provider',key);return Response.json({ok:true});}catch(e){return jsonError(e,400)}}
