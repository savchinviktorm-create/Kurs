'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { apiFetch, openTelegramInvoice, haptic } from '@/lib/client-api';
import Logo from '@/components/Logo';
import ProgressBar from '@/components/ProgressBar';

export default function HomePage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);

  async function load() {
    try {
      setError('');
      setData(await apiFetch('/api/bootstrap'));
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { load(); }, []);

  async function invoice(body) {
    try {
      setPaying(true);
      haptic('light');
      const res = await apiFetch('/api/payments/invoice', { method: 'POST', body: JSON.stringify(body) });
      openTelegramInvoice(res.invoice_url, () => {
        setPaying(false);
        setTimeout(load, 1200);
      });
    } catch (e) {
      setPaying(false);
      setError(e.message);
    }
  }

  if (!data && !error) return <main className="shell center"><div className="loader" /><p>Завантажуємо ваш простір…</p></main>;

  if (error) {
    return (
      <main className="shell center">
        <Logo />
        <div className="card errorCard">
          <h2>Не вдалося відкрити профіль</h2>
          <p>Відкрийте застосунок через Telegram-бот. Для локальної розробки можна ввімкнути DEMO-режим у .env.local.</p>
          <code>{error}</code>
          <button className="primary" onClick={load}>Спробувати ще раз</button>
        </div>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="hero">
        <Logo />
        <div>
          <div className="eyebrow">ПРОСТІР КОРИСНОГО КОНТЕНТУ</div>
          <h1>Вітаємо, {data.user.first_name} ✨</h1>
          <p>Ваші курси, прогрес і доступи зберігаються за вашим Telegram ID.</p>
        </div>
      </section>

      <section className="section">
        <div className="sectionHead"><div><span className="eyebrow">ВАШ ШЛЯХ</span><h2>Курси</h2></div></div>
        <div className="courseGrid">
          {data.courses.map((course) => {
            const attempt = course.attempt;
            const completed = attempt?.completed_steps || 0;
            const locked = !course.access;
            return (
              <article className="courseCard" key={course.slug}>
                <div className="courseLogoWrap">
                  <Image src={course.logo_path || '/technology-changes-logo.png'} alt="" width={160} height={160} />
                </div>
                <div className="courseBody">
                  <div className="pill">{course.is_free ? 'БЕЗКОШТОВНО' : locked ? 'ПЛАТНИЙ КУРС' : 'ДОСТУП АКТИВНИЙ'}</div>
                  <h3>{course.short_title}</h3>
                  <p>{course.total_steps} кроків • послідовне щоденне проходження</p>
                  {attempt && <ProgressBar completed={completed} total={course.total_steps} />}
                  {locked ? (
                    <button className="primary" disabled={paying} onClick={() => invoice({ type: 'course', course_slug: course.slug })}>
                      Придбати назавжди — {course.one_time_price_stars} ⭐
                    </button>
                  ) : (
                    <Link className="primary linkButton" href={`/course/${course.slug}`}>
                      {attempt ? 'Продовжити курс' : 'Відкрити курс'}
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="section card membership">
        <div>
          <span className="eyebrow">МАЙБУТНІ КУРСИ</span>
          <h2>Усі платні курси</h2>
          <p>{data.subscription.active
            ? `Підписка активна до ${new Date(data.subscription.expires_at).toLocaleString('uk-UA')}.`
            : 'Щомісячний доступ до всіх наявних платних курсів.'}</p>
        </div>
        {!data.subscription.active && (
          <button className="secondary" disabled={paying} onClick={() => invoice({ type: 'subscription' })}>
            {data.prices.all_access_subscription_stars} ⭐ / 30 днів
          </button>
        )}
      </section>

      <section className="section card donate">
        <div><span className="eyebrow">ПІДТРИМКА</span><h2>Підтримати автора ⭐</h2><p>Для «Технології змін» оплата не потрібна. Донат — лише за бажанням.</p></div>
        <div className="donationRow">
          {data.prices.donation_options.map((stars) => (
            <button className="starButton" disabled={paying} key={stars} onClick={() => invoice({ type: 'donation', stars })}>{stars} ⭐</button>
          ))}
        </div>
      </section>

      <footer className="footer"><Link href="/terms">Умови</Link><span>•</span><Link href="/paysupport">Підтримка платежів</Link></footer>
    </main>
  );
}
