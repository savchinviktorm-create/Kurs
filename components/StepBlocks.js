'use client';

import { useMemo, useState } from 'react';
import ProtectedMedia from './ProtectedMedia';
import { apiFetch, haptic } from '@/lib/client-api';

function ChecklistBlock({ block, courseSlug, attemptId }) {
  const items = useMemo(() => Array.isArray(block.config?.items) ? block.config.items : String(block.body || '').split('\n').filter(Boolean), [block]);
  const initial = Array.isArray(block.interaction?.state?.checked) ? block.interaction.state.checked : items.map(() => false);
  const [checked, setChecked] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(Boolean(block.interaction?.completed));

  async function toggle(index) {
    const next = checked.map((v, i) => i === index ? !v : v);
    setChecked(next);
    if (!courseSlug || !attemptId) return;
    try {
      setSaving(true);
      const r = await apiFetch(`/api/course/${courseSlug}/interaction`, {
        method: 'POST',
        body: JSON.stringify({ block_id: block.id, state: { checked: next } })
      });
      setSaved(Boolean(r.interaction?.completed));
      haptic('light');
    } catch {} finally { setSaving(false); }
  }

  return <div className={`stepChecklist ${block.config?.required ? 'requiredBlock' : ''}`}>
    {block.title && <h3>{block.title}</h3>}
    {block.config?.required && <p className="blockHint">Позначте всі пункти після виконання практики.</p>}
    {items.map((item, i) => <label key={i} className={checked[i] ? 'checked' : ''}><input type="checkbox" checked={Boolean(checked[i])} onChange={() => toggle(i)} /> <span>{item}</span></label>)}
    {saving && <small className="saveState">Зберігаємо…</small>}
    {saved && block.config?.required && <small className="saveState ok">✓ Практичний чекліст виконано</small>}
  </div>;
}

function QuizBlock({ block, courseSlug, attemptId }) {
  const questions = Array.isArray(block.config?.questions) ? block.config.questions : [];
  const savedState = block.interaction?.state || {};
  const [answers, setAnswers] = useState(Array.isArray(savedState.answers) ? savedState.answers : Array(questions.length).fill(null));
  const [result, setResult] = useState(savedState.attempted ? savedState : null);
  const [busy, setBusy] = useState(false);
  const allAnswered = questions.length > 0 && answers.every(v => Number.isInteger(v));

  async function submit() {
    if (!allAnswered || !courseSlug || !attemptId) return;
    try {
      setBusy(true);
      const r = await apiFetch(`/api/course/${courseSlug}/interaction`, {
        method: 'POST',
        body: JSON.stringify({ block_id: block.id, state: { answers } })
      });
      setResult(r.interaction?.state || null);
      haptic('medium');
    } finally { setBusy(false); }
  }

  return <section className={`quizBlock ${block.config?.required ? 'requiredBlock' : ''}`}>
    <div className="quizHead"><div><span className="eyebrow">САМОПЕРЕВІРКА</span><h3>{block.title || 'Перевірте себе'}</h3></div>{result?.attempted && <span className="quizScore">{result.score}/{result.total}</span>}</div>
    {questions.map((q, qi) => <div className="quizQuestion" key={q.id || qi}>
      <strong>{qi + 1}. {q.question}</strong>
      <div className="quizOptions">{(q.options || []).map((option, oi) => {
        const chosen = answers[qi] === oi;
        const revealed = Boolean(result?.attempted);
        const correct = Number(q.correct_index) === oi;
        const cls = revealed ? (correct ? 'correct' : chosen ? 'wrong' : '') : chosen ? 'selected' : '';
        return <button key={oi} type="button" disabled={revealed || busy} className={cls} onClick={() => setAnswers(answers.map((v, i) => i === qi ? oi : v))}><span>{String.fromCharCode(65 + oi)}</span>{option}</button>;
      })}</div>
      {result?.attempted && <div className="quizExplanation"><strong>{Number(result.answers?.[qi]) === Number(q.correct_index) ? '✓ Правильно.' : 'Пояснення:'}</strong> {q.explanation}</div>}
    </div>)}
    {!result?.attempted ? <button className="secondary quizSubmit" type="button" disabled={!allAnswered || busy} onClick={submit}>{busy ? 'Перевіряємо…' : 'Перевірити відповіді'}</button> : <p className="quizDone">✓ Самоперевірку пройдено. Результат збережено.</p>}
  </section>;
}

export default function StepBlocks({ blocks = [], spaceSlug, watermark, courseSlug, attemptId }) {
  if (!blocks.length) return null;
  return (
    <div className="stepBlocks">
      {blocks.map(block => {
        if (['video','audio','pdf','image','file'].includes(block.block_type) && block.media_asset_id) {
          return <section key={block.id} className="stepBlock mediaBlock">{block.title && <h3>{block.title}</h3>}<ProtectedMedia mediaId={block.media_asset_id} spaceSlug={spaceSlug} watermark={watermark} /></section>;
        }
        if (block.block_type === 'divider') return <hr key={block.id} className="goldDivider" />;
        if (block.block_type === 'link') return <p key={block.id} className="stepBlock"><a href={block.config?.url || '#'} target="_blank" rel="noreferrer">{block.title || block.body || 'Відкрити посилання'}</a></p>;
        if (block.block_type === 'quote') return <blockquote key={block.id} className="stepQuote">{block.title && <strong>{block.title}<br /></strong>}{block.body}</blockquote>;
        if (block.block_type === 'checklist') return <ChecklistBlock key={block.id} block={block} courseSlug={courseSlug} attemptId={attemptId} />;
        if (block.block_type === 'quiz') return <QuizBlock key={block.id} block={block} courseSlug={courseSlug} attemptId={attemptId} />;
        return <div key={block.id} className="courseText stepText stepBlock">{block.title && <h3>{block.title}</h3>}{block.body}</div>;
      })}
    </div>
  );
}
