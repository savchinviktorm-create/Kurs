'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/client-api';
import CertificatePanel from '@/components/CertificatePanel';

export default function CertificateDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { apiFetch(`/api/certificates/${id}`).then(setData).catch(e => setError(e.message)); }, [id]);
  if (!data && !error) return <main className="shell center"><div className="loader"/><p>Завантажуємо сертифікат…</p></main>;
  if (error) return <main className="shell center"><div className="card errorCard"><h2>Сертифікат не знайдено</h2><code>{error}</code><Link href="/certificates" className="primary linkButton">Мої сертифікати</Link></div></main>;
  const c = data.certificate;
  return <main className="shell certificatesShell"><header className="courseHeader"><Link href="/certificates" className="back">← Мої сертифікати</Link></header><CertificatePanel slug={c.course_slug} spaceSlug={c.space_slug || 'pkk'} lang={c.locale || 'uk'} initialCertificate={c} course={{ slug: c.course_slug, title: c.course_title_snapshot }} space={null}/></main>;
}
