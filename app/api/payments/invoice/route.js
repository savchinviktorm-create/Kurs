import crypto from 'crypto';
import { getAuthenticatedTelegramUser, upsertTelegramUser, jsonError } from '@/lib/telegram';
import { getSupabaseAdmin } from '@/lib/supabase';
import { telegramBotApi } from '@/lib/bot-api';
import { effectiveCourseConfig } from '@/lib/access';
import { getAppSetting } from '@/lib/platform';

export const runtime = 'nodejs';

function nonce() { return crypto.randomBytes(6).toString('hex'); }

export async function POST(request) {
  try {
    const user = await getAuthenticatedTelegramUser(request);
    await upsertTelegramUser(user);
    const body = await request.json();
    const type = body?.type;
    const supabase = getSupabaseAdmin();
    let title, description, amount, payload, subscription_period;

    if (type === 'donation') {
      amount = Number(body.stars);
      const options = await getAppSetting('donation_options', [10,25,50,100]);
      if (!Array.isArray(options) || !options.map(Number).includes(amount)) throw new Error('INVALID_DONATION_AMOUNT');
      title = 'Підтримати автора'; description = 'Добровільна підтримка розвитку корисного контенту.';
      payload = `donation|${user.id}|${amount}|${nonce()}`;
    } else if (type === 'course') {
      const slug = String(body.course_slug || '');
      const spaceSlug = String(body.space_slug || 'pkk');
      const { data: course, error } = await supabase.from('courses').select('*').eq('slug', slug).eq('is_published', true).maybeSingle();
      if (error) throw error;
      const { data: link } = await supabase.from('space_courses').select('*').eq('space_slug', spaceSlug).eq('course_slug', slug).eq('is_visible', true).maybeSingle();
      if (!course || !link) throw new Error('COURSE_NOT_PURCHASABLE');
      const cfg = effectiveCourseConfig(course, link);
      if (cfg.is_free || !cfg.one_time_price_stars) throw new Error('COURSE_NOT_PURCHASABLE');
      amount = cfg.one_time_price_stars;
      title = course.short_title || course.title; description = 'Постійний доступ до цього курсу.';
      payload = `course|${user.id}|${course.slug}|${spaceSlug}|${amount}|${nonce()}`;
    } else if (type === 'subscription') {
      const planKey = String(body.plan_key || 'all-access');
      const { data: plan, error } = await supabase.from('subscription_plans').select('*').eq('plan_key', planKey).eq('is_enabled', true).maybeSingle();
      if (error) throw error;
      if (!plan) throw new Error('SUBSCRIPTION_PLAN_NOT_FOUND');
      amount = plan.price_stars; title = plan.title; description = 'Доступ до платних курсів із поновленням.';
      payload = `subscription|${user.id}|${plan.plan_key}|${amount}|${nonce()}`;
      if (plan.is_recurring) subscription_period = plan.period_seconds;
    } else throw new Error('INVALID_INVOICE_TYPE');

    const invoiceUrl = await telegramBotApi('createInvoiceLink', {
      title: title.slice(0, 32), description: description.slice(0, 255), payload,
      currency: 'XTR', prices: [{ label: title.slice(0, 32), amount }],
      ...(subscription_period ? { subscription_period } : {})
    });
    return Response.json({ ok: true, invoice_url: invoiceUrl });
  } catch (error) { return jsonError(error, 400); }
}
