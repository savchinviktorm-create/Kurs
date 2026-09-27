import { requireAdmin } from '@/lib/admin';
import { getSupabaseAdmin } from '@/lib/supabase';
import { jsonError } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function count(supabase, table, filter) {
  let q = supabase.from(table).select('*', { count: 'exact', head: true });
  if (filter) q = filter(q);
  const { count, error } = await q; if (error) throw error; return count || 0;
}

export async function GET(request) {
  try {
    const { admin } = await requireAdmin(request, 'analyst');
    const sb = getSupabaseAdmin();
    const [users, courses, spaces, activeAttempts, finishedAttempts, activeSubs] = await Promise.all([
      count(sb,'users'), count(sb,'courses'), count(sb,'spaces',q=>q.eq('is_published',true)),
      count(sb,'course_attempts',q=>q.eq('status','active')), count(sb,'course_attempts',q=>q.eq('status','finished')),
      count(sb,'subscriptions',q=>q.gt('expires_at',new Date().toISOString()))
    ]);
    const { data: payments, error } = await sb.from('payments').select('amount_stars,kind,status,paid_at').eq('status','paid').order('paid_at',{ascending:false}).limit(5000);
    if (error) throw error;
    const stars = (payments||[]).reduce((s,p)=>s+Number(p.amount_stars||0),0);
    return Response.json({ ok:true, role:admin.role, stats:{ users,courses,spaces,active_attempts:activeAttempts,finished_attempts:finishedAttempts,active_subscriptions:activeSubs,stars_total:stars }, recent_payments:(payments||[]).slice(0,8) });
  } catch(e){ return jsonError(e,403); }
}
