import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function VerifyCertificatePage({ params }) {
  const { code } = await params;
  const sb = getSupabaseAdmin();
  const { data: cert } = await sb.from('course_certificates')
    .select('certificate_number,full_name,course_title_snapshot,brand_title_snapshot,completed_at,issued_at,status')
    .eq('verification_code', String(code || '')).maybeSingle();

  if (!cert || cert.status !== 'issued') {
    return <main className="verifyShell"><section className="verifyCard invalid"><div className="verifySeal">×</div><h1>Сертифікат не підтверджено</h1><p>Запис із таким кодом не знайдено або сертифікат відкликано.</p></section></main>;
  }

  const completed = new Date(cert.completed_at).toLocaleDateString('uk-UA', { day: '2-digit', month: 'long', year: 'numeric' });
  return <main className="verifyShell"><section className="verifyCard"><div className="verifySeal">✓</div><span className="eyebrow">ПЕРЕВІРКА СЕРТИФІКАТА</span><h1>Сертифікат підтверджено</h1><p className="verifyBrand">{cert.brand_title_snapshot}</p><dl><div><dt>Власник</dt><dd>{cert.full_name}</dd></div><div><dt>Курс</dt><dd>{cert.course_title_snapshot}</dd></div><div><dt>Завершено</dt><dd>{completed}</dd></div><div><dt>Номер</dt><dd><code>{cert.certificate_number}</code></dd></div></dl><p className="verifyFoot">Ця сторінка підтверджує, що сертифікат сформовано платформою після завершення відповідного курсу.</p></section></main>;
}
