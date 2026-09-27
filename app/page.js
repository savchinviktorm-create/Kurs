'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch, openTelegramInvoice, haptic } from '@/lib/client-api';
import Logo from '@/components/Logo';
import ProgressBar from '@/components/ProgressBar';
import LanguageSwitch from '@/components/LanguageSwitch';
import { t } from '@/lib/i18n';

export default function HomePage() {
  const router = useRouter();
  const [explicitSpace, setExplicitSpace] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);
  const [locale, setLocale] = useState(null);

  async function load(nextLocale = locale, spaceOverride = explicitSpace) {
    try {
      setError('');
      const qs = new URLSearchParams();
      if (nextLocale) qs.set('lang', nextLocale);
      if (spaceOverride) qs.set('space', spaceOverride);
      const suffix = qs.toString() ? `?${qs.toString()}` : '';
      const result = await apiFetch(`/api/bootstrap${suffix}`);
      setData(result); setLocale(result.locale);
    } catch (e) { setError(e.message); }
  }

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search).get('space');
    setExplicitSpace(sp);
    load(null, sp);
  }, []);

  useEffect(() => {
    if (!data?.entry?.course_slug) return;
    const params = new URLSearchParams({ space: data.space.slug, lang: data.locale });
    router.replace(`/course/${data.entry.course_slug}?${params.toString()}`);
  }, [data?.entry?.course_slug]);

  async function invoice(body) {
    try {
      setPaying(true); haptic('light');
      const res = await apiFetch('/api/payments/invoice', { method: 'POST', body: JSON.stringify({ ...body, space_slug: data.space.slug }) });
      openTelegramInvoice(res.invoice_url, () => { setPaying(false); setTimeout(() => load(locale), 1200); });
    } catch (e) { setPaying(false); setError(e.message); }
  }

  if (!data && !error) return <main className="shell center"><div className="loader" /><p>Завантажуємо ваш простір…</p></main>;
  if (error) return <main className="shell center"><Logo /><div className="card errorCard"><h2>Не вдалося відкрити профіль</h2><p>Відкрийте застосунок через Telegram-бот.</p><code>{error}</code><button className="primary" onClick={() => load(locale)}>Спробувати ще раз</button></div></main>;

  const tr = (key) => t(data.locale, key);
  const theme = data.space?.theme || {};
  const style = { '--space-accent': theme.accent_color || '#b9822f', '--ink': theme.text_color || '#2e241a', ...(theme.background_color ? { background: theme.background_color } : {}) };

  return (
    <main className="shell" style={style}>
      <div className="topUtility">
        <LanguageSwitch locale={data.locale} available={data.available_locales} onChange={(l) => { setLocale(l); load(l); }} />
        {data.is_admin && <Link className="adminShortcut" href="/admin">⚙ {tr('admin')}</Link>}
      </div>

      <section className="hero">
        {data.space.logo_path ? <div className="logo"><img src={data.space.logo_path} alt="" /></div> : <Logo />}
        <div>
          <div className="eyebrow">{data.space.short_title?.toUpperCase()}</div>
          <h1>{data.locale === 'ru' ? 'Добро пожаловать' : 'Вітаємо'}, {data.user.first_name} ✨</h1>
          <p>{data.space.hero_text || data.space.description}</p>
        </div>
      </section>

      <section className="section">
        <div className="sectionHead"><div><span className="eyebrow">{tr('yourPath')}</span><h2>{tr('courses')}</h2></div></div>
        {!data.courses.length && <div className="card emptyCard">{tr('noCourses')}</div>}
        <div className="courseGrid">
          {data.courses.map((course) => {
            const attempt = course.attempt;
            const completed = attempt?.completed_steps || 0;
            const locked = !course.access;
            const href = `/course/${course.slug}?space=${encodeURIComponent(data.space.slug)}&lang=${encodeURIComponent(data.locale)}`;
            return (
              <article className="courseCard" key={course.slug}>
                <div className="courseLogoWrap"><img src={course.logo_path || '/technology-changes-logo.png'} alt="" /></div>
                <div className="courseBody">
                  <div className="pill">{course.is_free ? tr('free') : locked ? tr('paid') : tr('accessActive')}</div>
                  <h3>{course.short_title}</h3>
                  {course.description && <p>{course.description}</p>}
                  <p>{course.total_steps} {tr('steps')}</p>
                  {attempt && <ProgressBar completed={completed} total={course.total_steps} />}
                  {locked ? (
                    <button className="primary" disabled={paying} onClick={() => invoice({ type: 'course', course_slug: course.slug })}>{tr('buyForever')} — {course.one_time_price_stars} ⭐</button>
                  ) : <Link className="primary linkButton" href={href}>{attempt ? tr('continueCourse') : tr('openCourse')}</Link>}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {data.has_paid_courses && (
        <section className="section card membership">
          <div><span className="eyebrow">ALL ACCESS</span><h2>{tr('allPaid')}</h2><p>{data.subscription.active ? `${tr('subscriptionActive')} ${new Date(data.subscription.expires_at).toLocaleString(data.locale === 'ru' ? 'ru-RU' : 'uk-UA')}.` : tr('monthlyAll')}</p></div>
          {!data.subscription.active && <button className="secondary" disabled={paying} onClick={() => invoice({ type: 'subscription', plan_key: data.prices.subscription_plan_key })}>{data.prices.all_access_subscription_stars} ⭐ / 30</button>}
        </section>
      )}

      <section className="section card donate">
        <div><span className="eyebrow">SUPPORT</span><h2>{tr('supportAuthor')} ⭐</h2><p>{tr('donateNote')}</p></div>
        <div className="donationRow">{data.prices.donation_options.map(stars => <button className="starButton" disabled={paying} key={stars} onClick={() => invoice({ type: 'donation', stars })}>{stars} ⭐</button>)}</div>
      </section>

      <footer className="footer"><Link href="/terms">{tr('terms')}</Link><span>•</span><Link href="/paysupport">{tr('paymentSupport')}</Link></footer>
    </main>
  );
}
