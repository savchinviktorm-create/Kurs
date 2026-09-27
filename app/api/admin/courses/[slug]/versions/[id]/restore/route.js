import { requireAdmin,auditAdmin } from '@/lib/admin';
import { snapshotCourse,restoreCourseSnapshot } from '@/lib/course-revisions';
import { jsonError } from '@/lib/telegram';
export const runtime='nodejs';
export async function POST(request,{params}){try{const{admin}=await requireAdmin(request,'admin');const{slug,id}=await params;await snapshotCourse(slug,admin.telegram_id,'draft','before-restore-'+Date.now());const v=await restoreCourseSnapshot(slug,id);await auditAdmin(admin.telegram_id,'course.restore','course',slug,{version_id:id,version_label:v.version_label});return Response.json({ok:true});}catch(e){return jsonError(e,400)}}
