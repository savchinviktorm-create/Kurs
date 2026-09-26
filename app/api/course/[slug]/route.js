import { getAuthenticatedTelegramUser, upsertTelegramUser, jsonError } from '@/lib/telegram';
import { loadCourseState } from '@/lib/course-state';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const user = await getAuthenticatedTelegramUser(request);
    await upsertTelegramUser(user);
    const { slug } = await params;
    const state = await loadCourseState(user.id, slug);
    return Response.json({ ok: true, user: { id: user.id, first_name: user.first_name }, ...state });
  } catch (error) {
    return jsonError(error, error?.message === 'COURSE_NOT_FOUND' ? 404 : 401);
  }
}
