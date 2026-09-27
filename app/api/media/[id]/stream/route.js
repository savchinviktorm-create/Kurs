import { verifyMediaToken } from '@/lib/media-token';
import { getMediaAsset, userCanAccessMedia, resolveMediaDelivery } from '@/lib/media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const token = new URL(request.url).searchParams.get('token');
    const claims = verifyMediaToken(token, id);
    if (!(await userCanAccessMedia(claims.u, id, claims.s))) return new Response('Forbidden', { status: 403 });
    const asset = await getMediaAsset(id);
    const delivery = await resolveMediaDelivery(asset);
    if (!delivery.url) return new Response('Unavailable', { status: 404 });
    return Response.redirect(delivery.url, 302);
  } catch (error) {
    return new Response('Media access denied', { status: 403 });
  }
}
