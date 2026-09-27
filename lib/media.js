import { getSupabaseAdmin } from './supabase';

function envFor(prefix, suffix) {
  if (!prefix) return undefined;
  return process.env[`${prefix}_${suffix}`];
}

export function youtubeId(input) {
  const s = String(input || '').trim();
  if (/^[\w-]{6,}$/.test(s) && !s.includes('/')) return s;
  try {
    const u = new URL(s);
    if (u.hostname.includes('youtu.be')) return u.pathname.split('/').filter(Boolean)[0];
    return u.searchParams.get('v') || u.pathname.split('/').filter(Boolean).pop();
  } catch { return s; }
}

export function vimeoId(input) {
  const s = String(input || '').trim();
  const m = s.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m?.[1] || s;
}

export async function getMediaAsset(mediaId) {
  const supabase = getSupabaseAdmin();
  const { data: asset, error } = await supabase
    .from('media_assets')
    .select('*, media_providers(*)')
    .eq('id', mediaId)
    .eq('status','ready')
    .maybeSingle();
  if (error) throw error;
  if (!asset) throw new Error('MEDIA_NOT_FOUND');
  return asset;
}

export async function resolveMediaDelivery(asset, { ttlSeconds = 300 } = {}) {
  const provider = asset.media_providers;
  if (!provider?.is_enabled) throw new Error('MEDIA_PROVIDER_DISABLED');
  const cfg = provider.config || {};
  const locator = asset.source_locator;

  switch (provider.delivery_type) {
    case 'supabase': {
      const bucket = cfg.bucket || 'course-media';
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(locator, ttlSeconds, { download: false });
      if (error) throw error;
      return { kind: asset.media_type === 'pdf' ? 'pdf' : asset.media_type, url: data.signedUrl };
    }
    case 'youtube':
      return { kind: 'iframe', url: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId(locator))}?rel=0&modestbranding=1&playsinline=1` };
    case 'vimeo':
      return { kind: 'iframe', url: `https://player.vimeo.com/video/${encodeURIComponent(vimeoId(locator))}?dnt=1&playsinline=1` };
    case 'cloudflare_stream': {
      const base = cfg.customer_subdomain || cfg.iframe_base || 'https://customer-REPLACE.cloudflarestream.com';
      return { kind: 'iframe', url: `${base.replace(/\/$/,'')}/${encodeURIComponent(locator)}/iframe` };
    }
    case 'bunny_stream': {
      const libraryId = cfg.library_id || envFor(provider.secret_env_prefix, 'LIBRARY_ID') || 'REPLACE';
      return { kind: 'iframe', url: `https://iframe.mediadelivery.net/embed/${encodeURIComponent(libraryId)}/${encodeURIComponent(locator)}?autoplay=false&preload=true` };
    }
    case 's3': {
      const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      const endpoint = cfg.endpoint || envFor(provider.secret_env_prefix, 'ENDPOINT');
      const region = cfg.region || envFor(provider.secret_env_prefix, 'REGION') || 'auto';
      const bucket = cfg.bucket || envFor(provider.secret_env_prefix, 'BUCKET');
      const accessKeyId = envFor(provider.secret_env_prefix, 'ACCESS_KEY_ID');
      const secretAccessKey = envFor(provider.secret_env_prefix, 'SECRET_ACCESS_KEY');
      if (!bucket || !accessKeyId || !secretAccessKey) throw new Error('S3_PROVIDER_NOT_CONFIGURED');
      const client = new S3Client({
        region,
        ...(endpoint ? { endpoint } : {}),
        forcePathStyle: Boolean(cfg.force_path_style),
        credentials: { accessKeyId, secretAccessKey }
      });
      const url = await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: locator }), { expiresIn: ttlSeconds });
      return { kind: asset.media_type === 'pdf' ? 'pdf' : asset.media_type, url };
    }
    case 'hls': return { kind: 'hls', url: locator };
    case 'dash': return { kind: 'dash', url: locator };
    case 'iframe': return { kind: 'iframe', url: locator };
    case 'direct':
    default: return { kind: asset.media_type === 'pdf' ? 'pdf' : asset.media_type, url: locator };
  }
}

export async function userCanAccessMedia(telegramId, mediaId, spaceSlug) {
  const supabase = getSupabaseAdmin();
  const { data: blocks, error } = await supabase
    .from('course_step_blocks')
    .select('course_slug')
    .eq('media_asset_id', mediaId)
    .eq('is_published', true)
    .limit(20);
  if (error) throw error;
  if (!blocks?.length) return false;

  const { hasCourseAccess } = await import('./access');
  for (const b of blocks) {
    const { data: course } = await supabase.from('courses').select('*').eq('slug', b.course_slug).eq('is_published', true).maybeSingle();
    if (!course) continue;
    let spaceCourse = null;
    if (spaceSlug) {
      const { data } = await supabase.from('space_courses').select('*').eq('space_slug', spaceSlug).eq('course_slug', course.slug).eq('is_visible', true).maybeSingle();
      spaceCourse = data;
    }
    if (await hasCourseAccess(telegramId, course, spaceCourse)) return true;
  }
  return false;
}
