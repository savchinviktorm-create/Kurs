'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Logo from '@/components/Logo';
import ProgressBar from '@/components/ProgressBar';
import { apiFetch, haptic } from '@/lib/client-api';

function Countdown({ target }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const text = useMemo(() => {
    const ms = Math.max(0, new Date(target).getTime() - now);
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${h}г ${m}хв ${s}с`;
  }, [target, now]);
  return <strong>{text}</strong>;
}

export default function CoursePage() {
  const { slug } = useParams();
  const [state, setState] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setError('');
      setState(await apiFetch(`/api/course/${slug}`));
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, [slug]);

  async function action(endpoint) {
    try {
      setBusy(true); setError(''); haptic('medium');
      const next = await apiFetch(`/api/course/${slug}/${endpoint}`, { method: 'POST' });
      setState(next);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  if (!state && !error) return <main className="shell center"><div className="loader" /><p>Завантажуємо крок…</p></main>;
  if (error && !state) return <main className="shell center"><div className="card errorCard"><h2>Помилка</h2><code>{error}</code><button className="primary" onClick={load}>Повторити</button></div></main>;

  const { course, attempt, step } = state;

  if (!state.access) {
    return <main className="shell center"><div className="card"><h2>Потрібен доступ до курсу</h2><p>Придбайте курс або активуйте підписку з головного екрана.</p><Link className="primary linkButton" href="/">До курсів</Link></div></main>;
  }

  return (
    <main className="shell courseShell">
      <header className="courseHeader"><Link href="/" className="back">← Курси</Link><Logo compact /></header>
      <div className="miniTitle"><span className="eyebrow">{course.short_title}</span></div>
      {attempt && <ProgressBar completed={attempt.completed_steps} total={course.total_steps} />}
      {error && <div className="inlineError">{error}</div>}

      {!attempt && (
        <section className="card introCard">
          <div className="ornament">✦</div>
          <div className="courseText">{course.intro_text}</div>
          <div className="startNote">Після старту перший крок відкриється наступного дня об {String(course.unlock_hour).padStart(2,'0')}:00 за часовим поясом курсу.</div>
          <button className="primary wide" disabled={busy} onClick={() => action('start')}>{busy ? 'Запускаємо…' : 'Розпочати 91-денний шлях'}</button>
        </section>
      )}

      {attempt?.status === 'finished' && (
        <section className="card finishCard">
          <div className="finishIcon">91/91</div>
          <h1>Курс завершено</h1>
          <p>Ви пройшли всі кроки послідовно. Фінальний результат збережено у вашому профілі.</p>
          <Link href="/" className="primary linkButton">До всіх курсів</Link>
        </section>
      )}

      {attempt?.status === 'active' && state.restart_recommended && (
        <section className="card restartCard">
          <span className="eyebrow">ПАУЗА 5+ ДНІВ</span>
          <h2>Варто почати спочатку?</h2>
          <p>Курс побудований на системності, постійності та послідовності. Після тривалої паузи рекомендуємо почати з першого кроку. Попередня спроба залишиться в історії.</p>
          <button className="secondary wide" disabled={busy} onClick={() => {
            if (confirm('Архівувати поточну спробу та почати курс спочатку?')) action('restart');
          }}>Почати з Кроку 1</button>
        </section>
      )}

      {attempt?.status === 'active' && !state.step_available && (
        <section className="card waitingCard">
          <div className="lockOrb">✦</div>
          <span className="eyebrow">НАСТУПНИЙ КРОК</span>
          <h2>Крок {attempt.current_step} ще закритий</h2>
          <p>Наступний крок відкриється автоматично. Пропущені дні не перескакують ваш прогрес.</p>
          <div className="countdown"><Countdown target={attempt.next_unlock_at} /></div>
          <div className="dateHint">{new Date(attempt.next_unlock_at).toLocaleString('uk-UA')}</div>
        </section>
      )}

      {attempt?.status === 'active' && state.step_available && step && (
        <section className="card stepCard">
          <div className="stepTop"><span className="pill">ДЕНЬ {step.step_number} / {course.total_steps}</span><span className="week">Тиждень {Math.ceil(step.step_number / 7)} із 13</span></div>
          <div className="courseText stepText">{step.content}</div>
          <div className="stepAction">
            <p>Після підтвердження цей крок закриється. Наступний відкриється лише наступного навчального дня.</p>
            <button className="primary wide" disabled={busy} onClick={() => action('complete')}>{busy ? 'Зберігаємо…' : 'Крок виконано ✓'}</button>
          </div>
        </section>
      )}
    </main>
  );
}
