import { getAuthenticatedTelegramUser, jsonError } from '@/lib/telegram';
import { getMediaAsset, userCanAccessMedia, resolveMediaDelivery } from '@/lib/media';
import { createMediaToken } from '@/lib/media-token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const user = await getAuthenticatedTelegramUser(request);
    const { id } = await params;
    const url = new URL(request.url);
    const spaceSlug = url.searchParams.get('space') || 'pkk';
    if (!(await userCanAccessMedia(user.id, id, spaceSlug))) throw new Error('MEDIA_ACCESS_REQUIRED');
    const asset = await getMediaAsset(id);
    const delivery = await resolveMediaDelivery(asset);
    const token = createMediaToken({ telegramId: user.id, mediaId: id, spaceSlug });
    return Response.json({
      ok: true,
      media: {
        id: asset.id,
        title: asset.title,
        media_type: asset.media_type,
        protection_level: asset.protection_level,
        watermark_enabled: asset.watermark_enabled,
        poster_url: asset.poster_url,
        provider_key: asset.provider_key
      },
      delivery: delivery.kind === 'iframe' ? delivery : { kind: delivery.kind, stream_url: `/api/media/${id}/stream?token=${encodeURIComponent(token)}` },
      iframe_url: delivery.kind === 'iframe' ? delivery.url : null
    });
  } catch (error) { return jsonError(error, 403); }
}
