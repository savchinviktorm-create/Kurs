import { getAuthenticatedTelegramUser, upsertTelegramUser } from './telegram';
import { getSupabaseAdmin } from './supabase';

const ROLE_RANK = { analyst: 1, support: 2, editor: 3, admin: 4, owner: 5 };

export async function getAdminForRequest(request) {
  const user = await getAuthenticatedTelegramUser(request);
  await upsertTelegramUser(user);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('admin_users')
    .select('telegram_id,role,permissions,enabled,label')
    .eq('telegram_id', user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data?.enabled) throw new Error('ADMIN_ACCESS_REQUIRED');
  return { user, admin: data };
}

export async function requireAdmin(request, minimumRole = 'analyst') {
  const ctx = await getAdminForRequest(request);
  if ((ROLE_RANK[ctx.admin.role] || 0) < (ROLE_RANK[minimumRole] || 0)) {
    throw new Error('ADMIN_PERMISSION_DENIED');
  }
  return ctx;
}

export async function auditAdmin(adminTelegramId, action, entityType, entityId, details = {}) {
  const supabase = getSupabaseAdmin();
  await supabase.from('audit_log').insert({
    admin_telegram_id: adminTelegramId,
    action,
    entity_type: entityType || null,
    entity_id: entityId ? String(entityId) : null,
    details
  });
}
