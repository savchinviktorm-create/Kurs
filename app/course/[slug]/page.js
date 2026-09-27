'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Logo from '@/components/Logo';
import ProgressBar from '@/components/ProgressBar';
import StepBlocks from '@/components/StepBlocks';
import ProtectedMedia from '@/components/ProtectedMedia';
import { apiFetch, haptic } from '@/lib/client-api';
import { t } from '@/lib/i18n';

function Countdown({ target }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const text = useMemo(() => {
    const ms = Math.max(0, new Date(target).getTime() - now);
    const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000); const s = Math.floor((ms % 60000) / 1000);
    return `${h}г ${m}хв ${s}с`;
  }, [target, now]);
  return <strong>{text}</strong>;
}


function FinishResources({ resources = [], spaceSlug, watermark }) {
  const [open, setOpen] = useState(null);
  if (!resources.length) return null;
  return <div className="finishResources"><h3>Матеріали курсу</h3>{resources.map((r, i) => <div className="finishResource" key={r.media_asset_id || i}><button className="secondary wide" onClick={() => setOpen(open === i ? null : i)}>{open === i ? 'Сховати' : 'Відкрити'} · {r.title || 'Матеріал'}</button>{open === i && <div className="finishResourceBody"><ProtectedMedia mediaId={r.media_asset_id} spaceSlug={spaceSlug} watermark={watermark} /></div>}</div>)}</div>;
}

export default function CoursePage() {
  const { slug } = useParams();
  const [query, setQuery] = useState({ space: 'pkk', lang: 'uk', ready: false });
  const { space, lang } = query;
  const [state, setState] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const qs = `?space=${encodeURIComponent(space)}&lang=${encodeURIComponent(lang)}`;
  async function load() { try { setError(''); setState(await apiFetch(`/api/course/${slug}${qs}`)); } catch (e) { setError(e.message); } }
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setQuery({ space: params.get('space') || 'pkk', lang: params.get('lang') || 'uk', ready: true });
  }, []);
  useEffect(() => { if (query.ready) load(); }, [slug, space, lang, query.ready]);

  async function action(endpoint) {
    try { setBusy(true); setError(''); haptic('medium'); setState(await apiFetch(`/api/course/${slug}/${endpoint}${qs}`, { method: 'POST' })); }
    catch (e) {
      setError(e.message === 'STEP_REQUIREMENTS_INCOMPLETE'
        ? (lang === 'ru' ? 'Сначала завершите обязательную практику и самопроверку.' : 'Спочатку завершіть обов’язкову практику та самоперевірку.')
        : e.message);
    } finally { setBusy(false); }
  }

  async function share() {
    try {
      haptic('light');
      const res = await apiFetch('/api/share', { method: 'POST', body: JSON.stringify({ space_slug: space, course_slug: slug, step_number: state?.step?.step_number || null }) });
      const text = encodeURIComponent(`${state.course.short_title} — ${lang === 'ru' ? 'курс в Telegram' : 'курс у Telegram'}`);
      const url = `https://t.me/share/url?url=${encodeURIComponent(res.url)}&text=${text}`;
      if (window.Telegram?.WebApp?.openTelegramLink) window.Telegram.WebApp.openTelegramLink(url); else window.open(url, '_blank');
    } catch (e) { setError(e.message); }
  }

  if (!state && !error) return <main className="shell center"><div className="loader" /><p>Завантажуємо крок…</p></main>;
  if (error && !state) return <main className="shell center"><div className="card errorCard"><h2>Помилка</h2><code>{error}</code><button className="primary" onClick={load}>Повторити</button></div></main>;

  const { course, attempt, step, blocks = [] } = state;
  const settings = course.settings || {};
  const selfPaced = settings.pacing === 'self_paced';
  const stepLabel = typeof settings.step_label === 'object' ? (settings.step_label[lang] || settings.step_label.uk || 'КРОК') : (settings.step_label || (lang === 'ru' ? 'ШАГ' : 'КРОК'));
  const showWeek = settings.show_week !== false;
  const tr = key => t(lang, key);
  const home = `/?space=${encodeURIComponent(space)}&lang=${encodeURIComponent(lang)}`;
  const wm = `${state.user?.username ? '@'+state.user.username : state.user?.first_name || 'Telegram'} · ID ${String(state.user?.id || '').slice(-6)} · ${new Date().toLocaleString(lang === 'ru' ? 'ru-RU' : 'uk-UA')}`;
  const theme = state.space?.theme || {};
  const shellStyle = { '--space-accent': theme.accent_color || '#b9822f', '--ink': theme.text_color || '#2e241a', ...(theme.background_color ? { background: theme.background_color } : {}) };

  if (!state.access) return <main className="shell center"><div className="card errorCard"><h2>{lang === 'ru' ? 'Нужен доступ к курсу' : 'Потрібен доступ до курсу'}</h2><Link className="primary linkButton" href={home}>{tr('backCourses')}</Link></div></main>;

  return (
    <main className="shell courseShell" style={shellStyle}>
      <header className="courseHeader"><Link href={home} className="back">{tr('backCourses')}</Link><button className="shareMini" onClick={share}>↗ {tr('share')}</button><Logo compact /></header>
      <div className="miniTitle"><span className="eyebrow">{course.short_title}</span></div>
      {attempt && <ProgressBar completed={attempt.completed_steps} total={course.total_steps} />}
      {error && <div className="inlineError">{error}</div>}

      {!attempt && <section className="card introCard">
        {course.cover_path ? <img className="courseCoverHero" src={course.cover_path} alt={course.title} /> : <div className="ornament">✦</div>}
        <h1 className="courseIntroTitle">{course.title}</h1>
        <div className={`courseText ${course.protection_level !== 'standard' ? 'protectedText' : ''}`}>{course.intro_text}</div>
        <div className="startNote">{selfPaced
          ? (lang === 'ru' ? 'Первое занятие откроется сразу. Дальше проходите курс в собственном темпе.' : 'Перше заняття відкриється одразу. Далі проходьте курс у власному темпі.')
          : `${tr('firstImmediate')} ${String(course.unlock_hour).padStart(2,'0')}:00.`}</div>
        <button className="primary wide" disabled={busy} onClick={() => action('start')}>{busy ? '…' : tr('start')}</button>
      </section>}

      {attempt?.status === 'finished' && <section className="card finishCard">
        <div className="finishIcon">{course.total_steps}/{course.total_steps}</div>
        <h1>{settings.finish_title || tr('courseFinished')}</h1>
        <div className="courseText finishText">{settings.finish_text || (lang === 'ru' ? 'Результат сохранён в вашем профиле.' : 'Результат збережено у вашому профілі.')}</div>
        <FinishResources resources={settings.finish_resources || []} spaceSlug={space} watermark={wm} />
        <button className="secondary" onClick={share}>↗ {tr('share')}</button><Link href={home} className="primary linkButton">{tr('backCourses')}</Link>
      </section>}

      {attempt?.status === 'active' && state.return_notice && <section className="card returnCard">
        <span className="eyebrow">{lang === 'ru' ? 'ВОЗВРАЩЕНИЕ К КУРСУ' : 'ПОВЕРНЕННЯ ДО КУРСУ'}</span>
        <h2>{settings.return_title || (lang === 'ru' ? 'Продолжим?' : 'Продовжимо?')}</h2>
        <div className="courseText returnText">{settings.return_text}</div>
      </section>}

      {attempt?.status === 'active' && state.restart_recommended && <section className="card restartCard"><span className="eyebrow">{tr('missedDays')}</span><h2>{lang === 'ru' ? 'Начать сначала?' : 'Варто почати спочатку?'}</h2><p>{lang === 'ru' ? 'Курс построен на системности и последовательности. Предыдущая попытка останется в истории.' : 'Курс побудований на системності та послідовності. Попередня спроба залишиться в історії.'}</p><button className="secondary wide" disabled={busy} onClick={() => { if (confirm(lang === 'ru' ? 'Архивировать попытку и начать заново?' : 'Архівувати спробу та почати заново?')) action('restart'); }}>{tr('restart')}</button></section>}

      {attempt?.status === 'active' && !state.step_available && <section className="card waitingCard"><div className="lockOrb">✦</div><span className="eyebrow">{tr('nextStep')}</span><h2>{lang === 'ru' ? 'Шаг' : 'Крок'} {attempt.current_step} {tr('stillLocked')}</h2><p>{lang === 'ru' ? 'Пропущенные дни не перескакивают прогресс.' : 'Пропущені дні не перескакують ваш прогрес.'}</p><div className="countdown"><Countdown target={attempt.next_unlock_at} /></div><div className="dateHint">{new Date(attempt.next_unlock_at).toLocaleString(lang === 'ru' ? 'ru-RU' : 'uk-UA')}</div></section>}

      {attempt?.status === 'active' && state.step_available && step && <section className="card stepCard protectedSurface" onContextMenu={e => course.protection_level !== 'standard' && e.preventDefault()}>
        <div className="stepTop"><span className="pill">{stepLabel.toUpperCase()} {step.step_number} / {course.total_steps}</span>{showWeek && <span className="week">{lang === 'ru' ? 'Неделя' : 'Тиждень'} {Math.ceil(step.step_number / 7)} / {Math.ceil(course.total_steps / 7)}</span>}</div>
        <h1 className="stepTitle">{step.title}</h1>
        {step.content && <div className={`courseText stepLead ${course.protection_level !== 'standard' ? 'protectedText' : ''}`}>{step.content}</div>}
        <StepBlocks blocks={blocks} spaceSlug={space} watermark={wm} courseSlug={slug} attemptId={attempt.id} />
        <div className="stepAction"><p>{settings.completion_note || (lang === 'ru' ? 'Завершайте шаг только после выполнения практики.' : 'Завершуйте крок лише після виконання практики.')}</p><button className="primary wide" disabled={busy} onClick={() => action('complete')}>{busy ? '…' : tr('complete')}</button><button className="shareInline" onClick={share}>↗ {tr('share')}</button></div>
      </section>}
    </main>
  );
}
