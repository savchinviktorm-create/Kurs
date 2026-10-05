'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/client-api';

export default function CertificatesPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { apiFetch('/api/certificates').then(setData).catch(e => setError(e.message)); }, []);
  if (!data && !error) return <main className="shell center"><div className="loader"/><p>Завантажуємо сертифікати…</p></main>;
  if (error) return <main className="shell center"><div className="card errorCard"><h2>Не вдалося відкрити сертифікати</h2><code>{error}</code><Link href="/" className="primary linkButton">На головну</Link></div></main>;
  return <main className="shell certificatesShell"><header className="courseHeader"><Link href="/" className="back">← До курсів</Link></header><section className="section"><span className="eyebrow">ACHIEVEMENTS</span><h1>Мої сертифікати</h1><p>Усі сертифікати, отримані після завершення курсів, зберігаються тут.</p>{!data.certificates.length&&<div className="card emptyCard">Поки що сертифікатів немає.</div>}<div className="certificateList">{data.certificates.map(c=><article className="card certificateListItem" key={c.id}><div className="certificateListSeal">✓</div><div><span className="eyebrow">{c.brand_title_snapshot}</span><h2>{c.course_title_snapshot}</h2><p><strong>{c.full_name}</strong></p><small>{new Date(c.completed_at).toLocaleDateString('uk-UA')} · {c.certificate_number}</small><div className="certificateListActions"><Link className="primary linkButton" href={`/certificates/${encodeURIComponent(c.id)}`}>Відкрити сертифікат</Link><Link className="secondary linkButton" href={`/verify/${encodeURIComponent(c.verification_code)}`} target="_blank">Перевірити</Link><Link className="secondary linkButton" href={`/course/${encodeURIComponent(c.course_slug)}?space=${encodeURIComponent(c.space_slug||'pkk')}`}>Відкрити курс</Link></div></div></article>)}</div></section></main>;
}
