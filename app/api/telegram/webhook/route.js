import { getSupabaseAdmin } from '@/lib/supabase';
import { telegramBotApi } from '@/lib/bot-api';
import { getPublicAppUrl, ALL_ACCESS_SUBSCRIPTION_STARS } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parsePayload(payload = '') {
  const parts = payload.split('|');
  if (parts[0] === 'donation' && parts.length === 4) {
    return { kind: 'donation', telegramId: Number(parts[1]), amount: Number(parts[2]) };
  }
  if (parts[0] === 'course' && parts.length === 5) {
    return { kind: 'course', telegramId: Number(parts[1]), courseSlug: parts[2], amount: Number(parts[3]) };
  }
  if (parts[0] === 'subscription' && parts.length === 5) {
    return { kind: 'subscription', telegramId: Number(parts[1]), planKey: parts[2], amount: Number(parts[3]) };
  }
  return null;
}

async function validateCheckout(query) {
  if (query.currency !== 'XTR') return { ok: false, message: 'Оплата має виконуватися в Telegram Stars.' };
  const parsed = parsePayload(query.invoice_payload);
  if (!parsed || parsed.telegramId !== query.from.id || parsed.amount !== query.total_amount) {
    return { ok: false, message: 'Не вдалося перевірити параметри платежу.' };
  }

  if (parsed.kind === 'donation') {
    if (![10, 25, 50, 100].includes(parsed.amount)) return { ok: false, message: 'Некоректна сума донату.' };
    return { ok: true };
  }

  if (parsed.kind === 'subscription') {
    return parsed.amount === ALL_ACCESS_SUBSCRIPTION_STARS
      ? { ok: true }
      : { ok: false, message: 'Ціна підписки змінилася. Відкрийте застосунок ще раз.' };
  }

  const supabase = getSupabaseAdmin();
  const { data: course } = await supabase
    .from('courses')
    .select('slug,is_free,one_time_price_stars')
    .eq('slug', parsed.courseSlug)
    .maybeSingle();
  if (!course || course.is_free || course.one_time_price_stars !== parsed.amount) {
    return { ok: false, message: 'Курс або його ціна змінилися. Відкрийте застосунок ще раз.' };
  }
  return { ok: true };
}

async function upsertFromTelegramUser(user) {
  const supabase = getSupabaseAdmin();
  await supabase.from('users').upsert({
    telegram_id: user.id,
    first_name: user.first_name || 'Telegram user',
    last_name: user.last_name || null,
    username: user.username || null,
    language_code: user.language_code || null,
    updated_at: new Date().toISOString()
  }, { onConflict: 'telegram_id' });
}

async function recordSuccessfulPayment(message) {
  const payment = message.successful_payment;
  const parsed = parsePayload(payment.invoice_payload);
  if (!parsed) return;
  await upsertFromTelegramUser(message.from);
  const supabase = getSupabaseAdmin();
  const expiresAt = payment.subscription_expiration_date
    ? new Date(payment.subscription_expiration_date * 1000).toISOString()
    : null;

  const { error: paymentError } = await supabase.from('payments').upsert({
    telegram_payment_charge_id: payment.telegram_payment_charge_id,
    telegram_id: message.from.id,
    kind: parsed.kind,
    course_slug: parsed.courseSlug || null,
    amount_stars: payment.total_amount,
    currency: payment.currency,
    invoice_payload: payment.invoice_payload,
    status: 'paid',
    is_recurring: Boolean(payment.is_recurring),
    is_first_recurring: Boolean(payment.is_first_recurring),
    subscription_expiration_at: expiresAt
  }, { onConflict: 'telegram_payment_charge_id', ignoreDuplicates: true });
  if (paymentError) throw paymentError;

  if (parsed.kind === 'course') {
    const { error } = await supabase.from('entitlements').upsert({
      telegram_id: message.from.id,
      course_slug: parsed.courseSlug,
      access_type: 'permanent',
      source_payment_charge_id: payment.telegram_payment_charge_id
    }, { onConflict: 'telegram_id,course_slug' });
    if (error) throw error;
  }

  if (parsed.kind === 'subscription') {
    const fallbackExpiration = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from('subscriptions').upsert({
      telegram_id: message.from.id,
      plan_key: 'all-access',
      expires_at: expiresAt || fallbackExpiration,
      source_payment_charge_id: payment.telegram_payment_charge_id,
      updated_at: new Date().toISOString()
    }, { onConflict: 'telegram_id' });
    if (error) throw error;
  }
}

async function recordRefund(message) {
  const refund = message.refunded_payment;
  const parsed = parsePayload(refund.invoice_payload);
  if (!parsed) return;
  const supabase = getSupabaseAdmin();
  await supabase.from('payments')
    .update({ status: 'refunded', refunded_at: new Date().toISOString() })
    .eq('telegram_payment_charge_id', refund.telegram_payment_charge_id);

  if (parsed.kind === 'course') {
    await supabase.from('entitlements')
      .delete()
      .eq('source_payment_charge_id', refund.telegram_payment_charge_id);
  }
  if (parsed.kind === 'subscription') {
    await supabase.from('subscriptions')
      .update({ expires_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('telegram_id', message.from.id);
  }
}

async function handleCommand(message) {
  const text = message.text || '';
  const appUrl = getPublicAppUrl();
  if (!appUrl) return;

  if (text.startsWith('/start')) {
    await telegramBotApi('sendMessage', {
      chat_id: message.chat.id,
      text: '⚙️ Технологія змін\n\nВідкрийте простір курсів і продовжуйте свій шлях крок за кроком.',
      reply_markup: {
        inline_keyboard: [[{ text: 'Відкрити Mini App', web_app: { url: appUrl } }]]
      }
    });
  } else if (text.startsWith('/terms')) {
    await telegramBotApi('sendMessage', {
      chat_id: message.chat.id,
      text: `Умови використання: ${appUrl}/terms`
    });
  } else if (text.startsWith('/paysupport')) {
    await telegramBotApi('sendMessage', {
      chat_id: message.chat.id,
      text: `Підтримка щодо платежів: ${appUrl}/paysupport`
    });
  }
}

export async function POST(request) {
  try {
    const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (expected) {
      const received = request.headers.get('x-telegram-bot-api-secret-token');
      if (received !== expected) return new Response('Forbidden', { status: 403 });
    }

    const update = await request.json();

    if (update.pre_checkout_query) {
      const result = await validateCheckout(update.pre_checkout_query);
      await telegramBotApi('answerPreCheckoutQuery', {
        pre_checkout_query_id: update.pre_checkout_query.id,
        ok: result.ok,
        ...(result.ok ? {} : { error_message: result.message })
      });
    }

    if (update.message?.successful_payment) await recordSuccessfulPayment(update.message);
    if (update.message?.refunded_payment) await recordRefund(update.message);
    if (update.message?.text) await handleCommand(update.message);

    return Response.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error', error);
    return Response.json({ ok: false }, { status: 500 });
  }
}
