import { getSupabaseAdmin } from '@/lib/supabase';
export const metadata = { title: 'Підтримка платежів' };
export const dynamic = 'force-dynamic';

export default async function PaySupport() {
  let support = { enabled:false, value:'' };
  try { const { data } = await getSupabaseAdmin().from('app_settings').select('value').eq('key','support').maybeSingle(); if(data?.value) support=data.value; } catch {}
  return <main className="shell legal"><h1>Підтримка платежів</h1><p>Якщо оплата Telegram Stars пройшла, але доступ не з’явився, перезапустіть Mini App. Права доступу видаються тільки після підтвердження successful_payment від Telegram.</p><p>Для ручної перевірки платежу вкажіть ваш Telegram username, приблизний час платежу, кількість Stars і назву придбаного курсу. Не надсилайте паролі, коди входу чи секретні ключі.</p>{support.enabled&&support.value?<p><b>Контакт підтримки:</b> {support.value}</p>:<p>Окремий контакт підтримки ще не опублікований власником платформи.</p>}</main>;
}
