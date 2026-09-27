'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/client-api';

function Field({ label, children }) { return <label className="adminField"><span>{label}</span>{children}</label>; }
const blankBlock = () => ({ block_type: 'text', title: '', body: '', media_asset_id: '', locale: null, config: {} });
const blankQuestion = () => ({ question: '', options: ['', '', ''], correct_index: 0, explanation: '' });

function QuizEditor({ block, onChange }) {
  const config = block.config || {};
  const questions = Array.isArray(config.questions) ? config.questions : [];
  const setQuestions = next => onChange({ ...block, config: { ...config, questions: next, required: config.required !== false, answer_policy: config.answer_policy || 'after_attempt' } });
  return <div className="quizAdminEditor">
    <label className="check"><input type="checkbox" checked={config.required !== false} onChange={e => onChange({ ...block, config: { ...config, required: e.target.checked } })} /> Обов’язкова самоперевірка перед завершенням заняття</label>
    {questions.map((q, qi) => <div className="quizAdminQuestion" key={qi}>
      <div className="blockToolbar"><strong>Питання {qi + 1}</strong><button className="danger" onClick={() => setQuestions(questions.filter((_, i) => i !== qi))}>×</button></div>
      <Field label="Питання"><textarea value={q.question || ''} onChange={e => setQuestions(questions.map((x, i) => i === qi ? { ...x, question: e.target.value } : x))} /></Field>
      <Field label="Варіанти відповідей — один рядок = один варіант"><textarea value={(q.options || []).join('\n')} onChange={e => setQuestions(questions.map((x, i) => i === qi ? { ...x, options: e.target.value.split('\n') } : x))} /></Field>
      <Field label="Номер правильної відповіді (1, 2, 3…)"><input type="number" min="1" value={Number(q.correct_index ?? 0) + 1} onChange={e => setQuestions(questions.map((x, i) => i === qi ? { ...x, correct_index: Math.max(0, Number(e.target.value || 1) - 1) } : x))} /></Field>
      <Field label="Пояснення після спроби"><textarea value={q.explanation || ''} onChange={e => setQuestions(questions.map((x, i) => i === qi ? { ...x, explanation: e.target.value } : x))} /></Field>
    </div>)}
    <button className="secondary" type="button" onClick={() => setQuestions([...questions, blankQuestion()])}>+ Питання</button>
  </div>;
}

export default function StepAdmin() {
  const { slug, step } = useParams();
  const [data, setData] = useState(null);
  const [locales, setLocales] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const r = await apiFetch(`/api/admin/courses/${slug}/steps/${step}`);
      setData(r);
      const ls = [...(r.locales || [])];
      if (!ls.find(x => x.locale === 'uk')) ls.push({ locale: 'uk', title: r.step.title, content: r.step.content });
      if (!ls.find(x => x.locale === 'ru')) ls.push({ locale: 'ru', title: '', content: '' });
      const serverBlocks = (r.blocks || []).map(b => ({ ...b, config: b.config || {} }));
      setLocales(ls); setBlocks(serverBlocks);
      try {
        const raw = localStorage.getItem(`admin-step-draft:${slug}:${step}`);
        if (raw) {
          const d = JSON.parse(raw);
          if (d?.at && confirm('Знайдено локальну автозбережену чернетку цього кроку. Відновити її?')) {
            if (Array.isArray(d.locales)) setLocales(d.locales);
            if (Array.isArray(d.blocks)) setBlocks(d.blocks);
          }
        }
      } catch {}
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, [slug, step]);
  useEffect(() => { if (!data) return; try { localStorage.setItem(`admin-step-draft:${slug}:${step}`, JSON.stringify({ locales, blocks, at: Date.now() })); } catch {} }, [locales, blocks]);

  async function save() {
    setBusy(true);
    try {
      await apiFetch(`/api/admin/courses/${slug}/steps/${step}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: locales.find(x => x.locale === 'uk')?.title || data.step.title,
          content: locales.find(x => x.locale === 'uk')?.content || data.step.content,
          locales,
          blocks: blocks.map((b, i) => ({ ...b, sort_order: (i + 1) * 10, media_asset_id: b.media_asset_id || null, title: b.title || null, body: b.body || null }))
        })
      });
      try { localStorage.removeItem(`admin-step-draft:${slug}:${step}`); } catch {}
      await load();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  if (!data) return <main className="adminShell">{error ? <div className="inlineError">{error}</div> : <div className="loader" />}</main>;
  return <main className="adminShell">
    <header className="adminHeader"><div><Link href={`/admin/course/${slug}`}>← Курс</Link><h1>Крок {step}</h1></div><button className="primary" disabled={busy} onClick={save}>Зберегти</button></header>
    {error && <div className="inlineError">{error}</div>}
    <p className="hint">Чернетка редактора автоматично зберігається локально у браузері; кнопка «Зберегти» публікує зміни в БД.</p>
    <div className="adminGrid two">
      <div><div className="adminCard"><h2>Текст кроку</h2>{locales.map((l, i) => <div className="localeBox" key={l.locale}><strong>{l.locale === 'uk' ? '🇺🇦 Українська' : '🇷🇺 Русский'}</strong><Field label="Заголовок"><input value={l.title || ''} onChange={e => setLocales(locales.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} /></Field><Field label="Текст — зберігається без автоматичного переписування"><textarea className="huge" value={l.content || ''} onChange={e => setLocales(locales.map((x, j) => j === i ? { ...x, content: e.target.value } : x))} /></Field></div>)}</div></div>
      <div>
        <div className="adminCard"><h2>Попередній перегляд тексту</h2><div className="courseText stepText">{locales.find(x => x.locale === 'uk')?.content || '—'}</div></div>
        <div className="adminCard"><div className="sectionHead"><h2>Додаткові блоки</h2><button className="secondary" onClick={() => setBlocks([...blocks, blankBlock()])}>+ Блок</button></div>
          {blocks.map((b, i) => <div className="blockEditor" key={b.id || i}>
            <div className="blockToolbar"><strong>#{i + 1}</strong><button onClick={() => i && setBlocks(blocks.map((x, j) => j === i ? blocks[i - 1] : j === i - 1 ? b : x))}>↑</button><button onClick={() => i < blocks.length - 1 && setBlocks(blocks.map((x, j) => j === i ? blocks[i + 1] : j === i + 1 ? b : x))}>↓</button><button className="danger" onClick={() => setBlocks(blocks.filter((_, j) => j !== i))}>×</button></div>
            <Field label="Тип"><select value={b.block_type} onChange={e => setBlocks(blocks.map((x, j) => j === i ? { ...x, block_type: e.target.value } : x))}>{['text','video','audio','pdf','image','file','link','quote','checklist','quiz','divider'].map(v => <option key={v}>{v}</option>)}</select></Field>
            <Field label="Мова блоку"><select value={b.locale || ''} onChange={e => setBlocks(blocks.map((x, j) => j === i ? { ...x, locale: e.target.value || null } : x))}><option value="">Спільний для мов</option><option value="uk">UK</option><option value="ru">RU</option></select></Field>
            {['video','audio','pdf','image','file'].includes(b.block_type) ? <Field label="Медіа"><select value={b.media_asset_id || ''} onChange={e => setBlocks(blocks.map((x, j) => j === i ? { ...x, media_asset_id: e.target.value } : x))}><option value="">— оберіть з Медіатеки —</option>{data.media.filter(m => m.media_type === b.block_type || (b.block_type === 'file' && m.media_type === 'file')).map(m => <option key={m.id} value={m.id}>{m.title} [{m.provider_key}]</option>)}</select></Field>
              : b.block_type === 'quiz' ? <><Field label="Заголовок"><input value={b.title || ''} onChange={e => setBlocks(blocks.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} /></Field><QuizEditor block={b} onChange={next => setBlocks(blocks.map((x, j) => j === i ? next : x))} /></>
              : b.block_type !== 'divider' && <><Field label="Заголовок"><input value={b.title || ''} onChange={e => setBlocks(blocks.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} /></Field><Field label="Текст / URL"><textarea value={b.body || ''} onChange={e => setBlocks(blocks.map((x, j) => j === i ? { ...x, body: e.target.value, config: b.block_type === 'link' ? { ...(x.config || {}), url: e.target.value } : x.config } : x))} /></Field>{b.block_type === 'checklist' && <label className="check"><input type="checkbox" checked={b.config?.required === true} onChange={e => setBlocks(blocks.map((x, j) => j === i ? { ...x, config: { ...(x.config || {}), required: e.target.checked } } : x))} /> Обов’язковий чекліст перед завершенням заняття</label>}</>}
          </div>)}
        </div>
      </div>
    </div>
  </main>;
}
