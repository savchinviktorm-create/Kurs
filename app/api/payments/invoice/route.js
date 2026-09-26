import crypto from 'crypto';
import { getAuthenticatedTelegramUser, upsertTelegramUser, jsonError } from '@/lib/telegram';
import { getSupabaseAdmin } from '@/lib/supabase';
import { telegramBotApi } from '@/lib/bot-api';
import { ALL_ACCESS_SUBSCRIPTION_STARS } from '@/lib/env';

export const runtime = 'nodejs';

const DONATION_OPTIONS = new Set([10, 25, 50, 100]);

function nonce() {
  return crypto.randomBytes(6).toString('hex');
}

export async function POST(request) {
  try {
    const user = await getAuthenticatedTelegramUser(request);
    await upsertTelegramUser(user);
    const body = await request.json();
    const type = body?.type;
    let title;
    let description;
    let amount;
    let payload;
    let subscription_period;

    if (type === 'donation') {
      amount = Number(body.stars);
      if (!DONATION_OPTIONS.has(amount)) throw new Error('INVALID_DONATION_AMOUNT');
      title = 'Підтримати автора';
      description = 'Добровільна підтримка розвитку корисного контенту.';
      payload = `donation|${user.id}|${amount}|${nonce()}`;
    } else if (type === 'course') {
      const slug = String(body.course_slug || '');
      const supabase = getSupabaseAdmin();
      const { data: course, error } = await supabase
        .from('courses')
        .select('slug,title,short_title,is_free,one_time_price_stars')
        .eq('slug', slug)
        .eq('is_published', true)
        .maybeSingle();
      if (error) throw error;
      if (!course || course.is_free || !course.one_time_price_stars) throw new Error('COURSE_NOT_PURCHASABLE');
      amount = course.one_time_price_stars;
      title = course.short_title || course.title;
      description = 'Постійний доступ до цього курсу.';
      payload = `course|${user.id}|${course.slug}|${amount}|${nonce()}`;
    } else if (type === 'subscription') {
      amount = ALL_ACCESS_SUBSCRIPTION_STARS;
      title = 'Усі курси — 30 днів';
      description = 'Доступ до всіх платних курсів із щомісячним поновленням.';
      payload = `subscription|${user.id}|all-access|${amount}|${nonce()}`;
      subscription_period = 2592000;
    } else {
      throw new Error('INVALID_INVOICE_TYPE');
    }

    const invoiceUrl = await telegramBotApi('createInvoiceLink', {
      title: title.slice(0, 32),
      description: description.slice(0, 255),
      payload,
      currency: 'XTR',
      prices: [{ label: title.slice(0, 32), amount }],
      ...(subscription_period ? { subscription_period } : {})
    });

    return Response.json({ ok: true, invoice_url: invoiceUrl });
  } catch (error) {
    return jsonError(error, 400);
  }
}
