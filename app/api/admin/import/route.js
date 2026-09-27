import JSZip from 'jszip';
import crypto from 'crypto';
import { requireAdmin, auditAdmin } from '@/lib/admin';
import { getSupabaseAdmin } from '@/lib/supabase';
import { jsonError } from '@/lib/telegram';
import { COURSE_IMPORT_MAX_BYTES } from '@/lib/env';

export const runtime = 'nodejs';

const slugify = v => String(v || '').toLowerCase().trim().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
const mime = (name = '') => name.match(/\.pdf$/i) ? 'application/pdf'
  : name.match(/\.mp3$/i) ? 'audio/mpeg'
  : name.match(/\.m4a$/i) ? 'audio/mp4'
  : name.match(/\.mp4$/i) ? 'video/mp4'
  : name.match(/\.webm$/i) ? 'video/webm'
  : name.match(/\.png$/i) ? 'image/png'
  : name.match(/\.webp$/i) ? 'image/webp'
  : name.match(/\.jpe?g$/i) ? 'image/jpeg'
  : 'application/octet-stream';
const mediaTypeFrom = (m, file = '') => m || (file.match(/\.pdf$/i) ? 'pdf' : file.match(/\.(mp3|m4a|wav)$/i) ? 'audio' : file.match(/\.(mp4|webm|mov)$/i) ? 'video' : file.match(/\.(png|jpe?g|webp)$/i) ? 'image' : 'file');

async function uploadPublicBrand(sb, zip, slug, filePath, kind) {
  if (!filePath) return null;
  const entry = zip.file(filePath);
  if (!entry) throw new Error(`BRAND_FILE_MISSING:${filePath}`);
  const bytes = Buffer.from(await entry.async('uint8array'));
  if (bytes.length > 6_000_000) throw new Error(`BRAND_IMAGE_TOO_LARGE:${filePath}`);
  const ext = filePath.match(/(\.[a-z0-9]{1,8})$/i)?.[1]?.toLowerCase() || '';
  const key = `imports/${slug}/${kind}-${crypto.randomUUID()}${ext}`;
  const { error } = await sb.storage.from('course-public').upload(key, bytes, { contentType: mime(filePath), upsert: false });
  if (error) throw error;
  const { data } = sb.storage.from('course-public').getPublicUrl(key);
  return data.publicUrl;
}

export async function POST(request) {
  let importId = null;
  try {
    const { admin } = await requireAdmin(request, 'editor');
    const fd = await request.formData();
    const file = fd.get('file');
    if (!file || typeof file === 'string') throw new Error('COURSE_PACKAGE_REQUIRED');
    if (file.size > COURSE_IMPORT_MAX_BYTES) throw new Error('PACKAGE_TOO_LARGE_USE_REMOTE_MEDIA_REFERENCES');

    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const manifestEntry = zip.file('manifest.json');
    if (!manifestEntry) throw new Error('MANIFEST_JSON_REQUIRED');
    const manifest = JSON.parse(await manifestEntry.async('string'));
    if (!['course-package-v1', 'course-package-v2'].includes(manifest.format)) throw new Error('UNSUPPORTED_COURSE_PACKAGE');
    if (!manifest.course || !Array.isArray(manifest.steps) || !manifest.steps.length) throw new Error('INVALID_COURSE_PACKAGE');

    const sb = getSupabaseAdmin();
    const slug = slugify(manifest.course.slug || manifest.course.short_title || manifest.course.title);
    if (!slug) throw new Error('INVALID_COURSE_SLUG');
    const report = { warnings: [], media: 0, steps: manifest.steps.length, locales: new Set(), slug, brand_assets: 0 };

    const { data: imp, error: impErr } = await sb.from('course_imports').insert({ imported_by: admin.telegram_id, source_name: file.name, course_slug: slug, status: 'processing' }).select('id').single();
    if (impErr) throw impErr;
    importId = imp.id;

    const existing = (await sb.from('courses').select('slug').eq('slug', slug).maybeSingle()).data;
    if (existing && manifest.mode !== 'update') throw new Error('COURSE_ALREADY_EXISTS_SET_MANIFEST_MODE_UPDATE');

    const steps = [...manifest.steps].sort((a, b) => Number(a.step_number) - Number(b.step_number));
    const numbers = steps.map(s => Number(s.step_number));
    const max = Math.max(...numbers);
    for (let i = 1; i <= max; i++) if (!numbers.includes(i)) report.warnings.push(`Missing step ${i}`);

    let logoPath = manifest.course.logo_path || null;
    let coverPath = manifest.course.cover_path || null;
    if (manifest.course.logo_file) { logoPath = await uploadPublicBrand(sb, zip, slug, manifest.course.logo_file, 'logo'); report.brand_assets++; }
    if (manifest.course.cover_file) { coverPath = await uploadPublicBrand(sb, zip, slug, manifest.course.cover_file, 'cover'); report.brand_assets++; }

    const defaultLocale = manifest.course.default_locale || 'uk';
    const base = {
      slug,
      title: manifest.course.title || slug,
      short_title: manifest.course.short_title || manifest.course.title || slug,
      description: manifest.course.description || null,
      intro_text: manifest.course.intro_text || '',
      logo_path: logoPath,
      cover_path: coverPath,
      total_steps: max,
      timezone: manifest.course.timezone || 'Europe/Kyiv',
      unlock_hour: Number(manifest.course.unlock_hour ?? 11),
      restart_offer_after_missed_days: Number(manifest.course.restart_offer_after_missed_days ?? 5),
      is_free: manifest.course.is_free !== false,
      one_time_price_stars: manifest.course.is_free !== false ? null : Number(manifest.course.one_time_price_stars || 99),
      included_in_subscription: manifest.course.included_in_subscription !== false,
      is_published: false,
      sort_order: Number(manifest.course.sort_order || 100),
      first_step_immediate: manifest.course.first_step_immediate !== false,
      allow_previous_steps: Boolean(manifest.course.allow_previous_steps),
      max_steps_per_day: Number(manifest.course.max_steps_per_day || 1),
      default_locale: defaultLocale,
      available_locales: manifest.course.available_locales || Object.keys(manifest.course.locales || { [defaultLocale]: {} }),
      protection_level: manifest.course.protection_level || 'standard',
      settings: manifest.course.settings || {},
      updated_at: new Date().toISOString()
    };
    const courseWrite = existing ? sb.from('courses').update(base).eq('slug', slug) : sb.from('courses').insert(base);
    const courseResult = await courseWrite;
    if (courseResult.error) throw courseResult.error;

    const courseLocales = manifest.course.locales || { [defaultLocale]: { title: base.title, short_title: base.short_title, description: base.description, intro_text: base.intro_text } };
    for (const [locale, l] of Object.entries(courseLocales)) {
      report.locales.add(locale);
      let localeLogo = l.logo_path || base.logo_path;
      let localeCover = l.cover_path || base.cover_path;
      if (l.logo_file) { localeLogo = await uploadPublicBrand(sb, zip, `${slug}-${locale}`, l.logo_file, 'logo'); report.brand_assets++; }
      if (l.cover_file) { localeCover = await uploadPublicBrand(sb, zip, `${slug}-${locale}`, l.cover_file, 'cover'); report.brand_assets++; }
      const { error } = await sb.from('course_locales').upsert({
        course_slug: slug, locale, title: l.title || base.title, short_title: l.short_title || l.title || base.short_title,
        description: l.description ?? base.description, intro_text: l.intro_text ?? base.intro_text,
        logo_path: localeLogo, cover_path: localeCover, is_published: l.is_published !== false, updated_at: new Date().toISOString()
      }, { onConflict: 'course_slug,locale' });
      if (error) throw error;
    }

    const mediaMap = {};
    for (const m of manifest.media || []) {
      let locator = m.source_locator || m.url || '';
      let provider = m.provider_key || 'direct';
      const mt = mediaTypeFrom(m.media_type, m.file || '');
      let size = null;
      let mimeType = m.mime_type || null;
      if (m.file) {
        const entry = zip.file(m.file);
        if (!entry) throw new Error(`MEDIA_FILE_MISSING:${m.file}`);
        const bytes = Buffer.from(await entry.async('uint8array'));
        const key = `imports/${slug}/${crypto.randomUUID()}-${m.file.split('/').pop()}`;
        const { error } = await sb.storage.from('course-media').upload(key, bytes, { contentType: mime(m.file), upsert: false });
        if (error) throw error;
        locator = key; provider = 'supabase'; size = bytes.length; mimeType = mime(m.file);
      }
      if (!locator) throw new Error(`MEDIA_LOCATOR_REQUIRED:${m.key || m.title}`);
      const { data, error } = await sb.from('media_assets').insert({
        provider_key: provider, media_type: mt, title: m.title || m.key || 'Медіа', source_locator: locator,
        mime_type: mimeType, size_bytes: size, poster_url: m.poster_url || null,
        protection_level: m.protection_level || base.protection_level || 'enhanced', watermark_enabled: m.watermark_enabled !== false,
        metadata: m.metadata || {}, status: 'ready'
      }).select('id').single();
      if (error) throw error;
      mediaMap[m.key || data.id] = data.id;
      report.media++;
    }

    if (Array.isArray(base.settings?.finish_resources)) {
      base.settings = {
        ...base.settings,
        finish_resources: base.settings.finish_resources.map(r => ({
          ...r,
          media_asset_id: r.media_asset_id || mediaMap[r.media_key] || null
        })).filter(r => r.media_asset_id)
      };
      const { error: settingsError } = await sb.from('courses').update({ settings: base.settings, updated_at: new Date().toISOString() }).eq('slug', slug);
      if (settingsError) throw settingsError;
    }

    for (const s of steps) {
      const n = Number(s.step_number);
      const title = s.title || `Крок ${n}`;
      const content = s.content || '';
      const x = await sb.from('course_steps').upsert({ course_slug: slug, step_number: n, title, content }, { onConflict: 'course_slug,step_number' });
      if (x.error) throw x.error;
      const sl = s.locales || { [defaultLocale]: { title, content } };
      for (const [locale, l] of Object.entries(sl)) {
        report.locales.add(locale);
        const { error } = await sb.from('course_step_locales').upsert({ course_slug: slug, step_number: n, locale, title: l.title || title, content: l.content ?? content, updated_at: new Date().toISOString() }, { onConflict: 'course_slug,step_number,locale' });
        if (error) throw error;
      }
      if (Array.isArray(s.blocks)) {
        await sb.from('course_step_blocks').delete().eq('course_slug', slug).eq('step_number', n);
        const rows = [];
        for (let i = 0; i < s.blocks.length; i++) {
          const b = s.blocks[i];
          let mediaId = b.media_asset_id || mediaMap[b.media_key] || null;
          if (b.media && !mediaId) {
            const locator = b.media.source_locator || b.media.url;
            if (!locator) throw new Error(`BLOCK_MEDIA_LOCATOR_REQUIRED:${n}:${i}`);
            const { data, error } = await sb.from('media_assets').insert({
              provider_key: b.media.provider_key || 'direct', media_type: mediaTypeFrom(b.media.media_type, locator),
              title: b.media.title || b.title || `Step ${n} media`, source_locator: locator,
              poster_url: b.media.poster_url || null, protection_level: b.media.protection_level || base.protection_level || 'enhanced',
              watermark_enabled: b.media.watermark_enabled !== false, status: 'ready'
            }).select('id').single();
            if (error) throw error;
            mediaId = data.id; report.media++;
          }
          rows.push({
            course_slug: slug, step_number: n, locale: b.locale || null, block_type: b.block_type || b.type || 'text',
            sort_order: Number(b.sort_order ?? (i + 1) * 10), title: b.title || null, body: b.body || b.text || null,
            media_asset_id: mediaId, config: b.config || {}, is_published: b.is_published !== false
          });
        }
        if (rows.length) {
          const { error } = await sb.from('course_step_blocks').insert(rows);
          if (error) throw error;
        }
      }
    }

    for (const sp of manifest.spaces || []) {
      const spaceSlug = slugify(sp.slug || sp.space_slug);
      if (!spaceSlug) continue;
      const { data: exists } = await sb.from('spaces').select('slug').eq('slug', spaceSlug).maybeSingle();
      if (!exists) { report.warnings.push(`Space ${spaceSlug} not found; course not assigned there.`); continue; }
      const { error } = await sb.from('space_courses').upsert({
        space_slug: spaceSlug, course_slug: slug, is_visible: sp.is_visible === true, sort_order: Number(sp.sort_order || 100),
        price_override_stars: sp.price_override_stars ? Number(sp.price_override_stars) : null,
        access_override: sp.access_override || null,
        included_in_subscription_override: sp.included_in_subscription_override ?? null
      }, { onConflict: 'space_slug,course_slug' });
      if (error) throw error;
    }
    if (!(manifest.spaces || []).length) {
      await sb.from('space_courses').upsert({ space_slug: 'pkk', course_slug: slug, is_visible: false, sort_order: base.sort_order }, { onConflict: 'space_slug,course_slug' });
      report.warnings.push('Assigned to pkk as hidden draft.');
    }

    const versionLabel = manifest.version || `import-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0,14)}`;
    await sb.from('course_versions').upsert({ course_slug: slug, version_label: versionLabel, status: 'draft', manifest, created_by: admin.telegram_id }, { onConflict: 'course_slug,version_label' });
    report.locales = [...report.locales];
    await sb.from('course_imports').update({ status: 'ready', report, finished_at: new Date().toISOString() }).eq('id', importId);
    await auditAdmin(admin.telegram_id, 'course.import', 'course', slug, report);
    return Response.json({ ok: true, course_slug: slug, report });
  } catch (e) {
    try { if (importId) await getSupabaseAdmin().from('course_imports').update({ status: 'error', report: { error: e.message }, finished_at: new Date().toISOString() }).eq('id', importId); } catch {}
    return jsonError(e, 400);
  }
}
