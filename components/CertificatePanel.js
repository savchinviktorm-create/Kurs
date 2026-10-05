'use client';

import { useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { apiFetch, haptic } from '@/lib/client-api';

const A4_W = 1754;
const A4_H = 1240;

function verificationUrl(code) {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/verify/${encodeURIComponent(code)}`;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    if (!src) return reject(new Error('NO_IMAGE'));
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function wrapLines(ctx, text, maxWidth, maxLines = 3) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth || !current) current = test;
    else { lines.push(current); current = word; }
  }
  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines;
  const clipped = lines.slice(0, maxLines);
  clipped[maxLines - 1] = clipped[maxLines - 1].replace(/[.…]*$/, '') + '…';
  return clipped;
}

function drawCenteredLines(ctx, lines, y, lineHeight) {
  lines.forEach((line, i) => ctx.fillText(line, A4_W / 2, y + i * lineHeight));
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function renderCertificate(cert, space) {
  const canvas = document.createElement('canvas');
  canvas.width = A4_W;
  canvas.height = A4_H;
  const ctx = canvas.getContext('2d');
  const accent = cert.metadata?.accent_color || space?.theme?.accent_color || '#B9822F';
  const dark = '#2B2118';

  const bg = ctx.createLinearGradient(0, 0, A4_W, A4_H);
  bg.addColorStop(0, '#fffdf8');
  bg.addColorStop(.5, '#fff8e9');
  bg.addColorStop(1, '#fbf2df');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, A4_W, A4_H);

  ctx.strokeStyle = accent;
  ctx.lineWidth = 8;
  ctx.strokeRect(40, 40, A4_W - 80, A4_H - 80);
  ctx.lineWidth = 2;
  ctx.strokeRect(58, 58, A4_W - 116, A4_H - 116);

  ctx.globalAlpha = 0.09;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  for (let r = 120; r < 750; r += 54) {
    ctx.beginPath(); ctx.arc(A4_W / 2, 620, r, Math.PI * 1.04, Math.PI * 1.96); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const logoSrc = cert.metadata?.space_logo_path || space?.logo_path;
  if (logoSrc) {
    try {
      const logo = await loadImage(logoSrc);
      ctx.save();
      ctx.globalAlpha = 0.96;
      const size = 150;
      roundedRect(ctx, A4_W / 2 - size / 2, 90, size, size, 28);
      ctx.clip();
      ctx.drawImage(logo, A4_W / 2 - size / 2, 90, size, size);
      ctx.restore();
    } catch {}
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.font = '600 30px Arial, sans-serif';
  ctx.letterSpacing = '5px';
  ctx.fillText(String(cert.brand_title_snapshot || 'ПРОСТІР ПРАКТИЧНОГО КОНТЕНТУ').toUpperCase(), A4_W / 2, 292);
  ctx.letterSpacing = '0px';

  ctx.fillStyle = dark;
  ctx.font = '700 84px Georgia, "Times New Roman", serif';
  ctx.fillText('СЕРТИФІКАТ', A4_W / 2, 410);
  ctx.fillStyle = accent;
  ctx.font = '500 30px Arial, sans-serif';
  ctx.fillText(cert.metadata?.subtitle || 'Сертифікат про завершення курсу', A4_W / 2, 466);

  ctx.fillStyle = '#6c5a48';
  ctx.font = '400 27px Arial, sans-serif';
  ctx.fillText('Цим підтверджується, що', A4_W / 2, 545);

  ctx.fillStyle = dark;
  let nameSize = 58;
  ctx.font = `700 ${nameSize}px Georgia, "Times New Roman", serif`;
  while (ctx.measureText(cert.full_name).width > 1200 && nameSize > 38) {
    nameSize -= 2; ctx.font = `700 ${nameSize}px Georgia, "Times New Roman", serif`;
  }
  ctx.fillText(cert.full_name, A4_W / 2, 630);
  ctx.strokeStyle = accent; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(345, 660); ctx.lineTo(A4_W - 345, 660); ctx.stroke();

  ctx.fillStyle = '#6c5a48';
  ctx.font = '400 27px Arial, sans-serif';
  ctx.fillText('успішно завершив(ла) курс', A4_W / 2, 723);

  ctx.fillStyle = dark;
  let courseSize = 47;
  let courseLines = [];
  do {
    ctx.font = `700 ${courseSize}px Georgia, "Times New Roman", serif`;
    courseLines = wrapLines(ctx, cert.course_title_snapshot, 1220, 2);
    if (courseLines.length <= 2) break;
    courseSize -= 2;
  } while (courseSize > 34);
  drawCenteredLines(ctx, courseLines, 800, 58);

  const completed = new Date(cert.completed_at).toLocaleDateString('uk-UA', { day: '2-digit', month: 'long', year: 'numeric' });
  ctx.fillStyle = '#6c5a48';
  ctx.font = '400 24px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Дата завершення', 150, 1015);
  ctx.fillStyle = dark; ctx.font = '600 29px Arial, sans-serif';
  ctx.fillText(completed, 150, 1055);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#6c5a48'; ctx.font = '400 22px Arial, sans-serif';
  ctx.fillText('Номер сертифіката', A4_W / 2, 1015);
  ctx.fillStyle = dark; ctx.font = '600 27px "Courier New", monospace';
  ctx.fillText(cert.certificate_number, A4_W / 2, 1055);

  if (cert.metadata?.signatory_name) {
    ctx.textAlign = 'right';
    ctx.fillStyle = dark; ctx.font = '600 27px Georgia, "Times New Roman", serif';
    ctx.fillText(cert.metadata.signatory_name, A4_W - 150, 1015);
    ctx.fillStyle = '#6c5a48'; ctx.font = '400 21px Arial, sans-serif';
    ctx.fillText(cert.metadata.signatory_title || '', A4_W - 150, 1050);
  }

  if (cert.metadata?.verification_enabled !== false) {
    try {
      const url = verificationUrl(cert.verification_code);
      const qrUrl = await QRCode.toDataURL(url, { width: 180, margin: 1, errorCorrectionLevel: 'M' });
      const qr = await loadImage(qrUrl);
      ctx.drawImage(qr, A4_W - 300, 865, 150, 150);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#6c5a48'; ctx.font = '400 18px Arial, sans-serif';
      ctx.fillText('Перевірити справжність', A4_W - 150, 1045);
    } catch {}
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.beginPath(); ctx.arc(A4_W / 2, 1130, 9, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = accent; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(A4_W / 2 - 210, 1130); ctx.lineTo(A4_W / 2 - 30, 1130); ctx.moveTo(A4_W / 2 + 30, 1130); ctx.lineTo(A4_W / 2 + 210, 1130); ctx.stroke();

  return canvas;
}

function dataUrlToBytes(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function ascii(str) { return new TextEncoder().encode(str); }
function joinBytes(parts) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total); let offset = 0;
  for (const p of parts) { out.set(p, offset); offset += p.length; }
  return out;
}

function jpegToPdfBlob(jpegDataUrl, pxWidth, pxHeight) {
  const image = dataUrlToBytes(jpegDataUrl);
  const pageW = 841.89, pageH = 595.28;
  const content = `q\n${pageW} 0 0 ${pageH} 0 0 cm\n/Im0 Do\nQ\n`;
  const objects = [
    [ascii('<< /Type /Catalog /Pages 2 0 R >>')],
    [ascii('<< /Type /Pages /Kids [3 0 R] /Count 1 >>')],
    [ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> >> /ProcSet [/PDF /ImageC] >> /Contents 5 0 R >>`)],
    [ascii(`<< /Type /XObject /Subtype /Image /Width ${pxWidth} /Height ${pxHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`), image, ascii('\nendstream')],
    [ascii(`<< /Length ${ascii(content).length} >>\nstream\n${content}endstream`)]
  ];
  const parts = [ascii('%PDF-1.4\n%âãÏÓ\n')];
  const offsets = [0];
  let length = parts[0].length;
  objects.forEach((bodyParts, i) => {
    offsets[i + 1] = length;
    const head = ascii(`${i + 1} 0 obj\n`), tail = ascii('\nendobj\n');
    parts.push(head, ...bodyParts, tail);
    length += head.length + bodyParts.reduce((n, p) => n + p.length, 0) + tail.length;
  });
  const xrefOffset = length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  parts.push(ascii(xref));
  return new Blob([joinBytes(parts)], { type: 'application/pdf' });
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export default function CertificatePanel({ slug, spaceSlug, lang = 'uk', initialCertificate = null, course, space }) {
  const [certificate, setCertificate] = useState(initialCertificate);
  const [fullName, setFullName] = useState(initialCertificate?.full_name || '');
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(Boolean(initialCertificate));
  const [error, setError] = useState('');
  const [preview, setPreview] = useState('');
  const qs = useMemo(() => `?space=${encodeURIComponent(spaceSlug)}&lang=${encodeURIComponent(lang)}`, [spaceSlug, lang]);

  async function issue() {
    try {
      setBusy(true); setError(''); haptic('medium');
      const res = await apiFetch(`/api/course/${slug}/certificate${qs}`, { method: 'POST', body: JSON.stringify({ full_name: fullName }) });
      setCertificate(res.certificate); setPreview('');
    } catch (e) {
      setError(e.message === 'INVALID_CERTIFICATE_NAME'
        ? (lang === 'ru' ? 'Введите полное имя для сертификата.' : 'Введіть повне ПІБ для сертифіката.')
        : e.message);
    } finally { setBusy(false); }
  }

  async function build() {
    if (!certificate) return null;
    const canvas = await renderCertificate(certificate, space);
    const png = canvas.toDataURL('image/png');
    const jpeg = canvas.toDataURL('image/jpeg', 0.96);
    const pdf = jpegToPdfBlob(jpeg, canvas.width, canvas.height);
    return { canvas, png, pdf };
  }

  async function showPreview() {
    try { setBusy(true); const out = await build(); if (out) setPreview(out.png); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  async function downloadPdf() {
    try {
      setBusy(true); const out = await build(); if (!out) return;
      const safe = String(certificate.full_name || 'certificate').replace(/[^\p{L}\p{N}._-]+/gu, '_');
      saveBlob(out.pdf, `certificate_${safe}.pdf`);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  async function shareCertificate() {
    try {
      setBusy(true); const out = await build(); if (!out) return;
      const canFileShare = typeof File !== 'undefined' && navigator.share && navigator.canShare;
      const file = canFileShare ? new File([out.pdf], `${certificate.certificate_number}.pdf`, { type: 'application/pdf' }) : null;
      if (file && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: certificate.course_title_snapshot, text: certificate.brand_title_snapshot, files: [file] });
      } else {
        const url = verificationUrl(certificate.verification_code);
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(`${certificate.full_name} · ${certificate.course_title_snapshot} · ${certificate.certificate_number}`)}`;
        if (window.Telegram?.WebApp?.openTelegramLink) window.Telegram.WebApp.openTelegramLink(shareUrl); else window.open(shareUrl, '_blank');
      }
    } catch (e) { if (e?.name !== 'AbortError') setError(e.message); } finally { setBusy(false); }
  }

  return <section className="certificatePanel">
    <span className="eyebrow">CERTIFICATE</span>
    <h2>{lang === 'ru' ? 'Ваш сертификат' : 'Ваш сертифікат'}</h2>
    {!certificate ? <>
      <p>{lang === 'ru' ? 'Введите имя и фамилию так, как они должны быть указаны в сертификате.' : 'Введіть ПІБ саме так, як воно має бути зазначене у сертифікаті.'}</p>
      <label className="certificateNameField"><span>{lang === 'ru' ? 'ФИО для сертификата' : 'ПІБ для сертифіката'}</span><input value={fullName} onChange={e => { setFullName(e.target.value); setConfirmed(false); }} maxLength={160} placeholder={lang === 'ru' ? 'Фамилия Имя Отчество' : 'Прізвище Ім’я По батькові'} /></label>
      <label className="certificateConfirm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /> <span>{lang === 'ru' ? 'Проверьте написание — оно попадёт в сертификат.' : 'Перевірте написання — воно потрапить у сертифікат.'}</span></label>
      <button className="primary wide" disabled={busy || fullName.trim().length < 3 || !confirmed} onClick={issue}>{busy ? '…' : (lang === 'ru' ? 'Создать сертификат' : 'Створити сертифікат')}</button>
    </> : <>
      <div className="certificateIssued"><strong>{certificate.full_name}</strong><span>{certificate.certificate_number}</span></div>
      {preview && <img className="certificatePreview" src={preview} alt={lang === 'ru' ? 'Предпросмотр сертификата' : 'Попередній перегляд сертифіката'} />}
      <div className="certificateActions"><button className="secondary" disabled={busy} onClick={showPreview}>{preview ? (lang === 'ru' ? 'Обновить просмотр' : 'Оновити перегляд') : (lang === 'ru' ? 'Посмотреть' : 'Переглянути')}</button><button className="primary" disabled={busy} onClick={downloadPdf}>{lang === 'ru' ? 'Сохранить PDF' : 'Зберегти PDF'}</button><button className="secondary" disabled={busy} onClick={shareCertificate}>↗ {lang === 'ru' ? 'Поделиться' : 'Поділитися'}</button></div>
      <button className="certificateEdit" onClick={() => { setCertificate(null); setConfirmed(false); }}>{lang === 'ru' ? 'Исправить имя' : 'Виправити ПІБ'}</button>
    </>}
    {error && <div className="inlineError">{error}</div>}
  </section>;
}
