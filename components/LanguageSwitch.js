'use client';

import { apiFetch, haptic } from '@/lib/client-api';

export default function LanguageSwitch({ locale, available = ['uk'], onChange }) {
  if (!available || available.length < 2) return null;
  async function pick(next) {
    if (next === locale) return;
    haptic('light');
    try { await apiFetch('/api/profile/locale', { method: 'POST', body: JSON.stringify({ locale: next }) }); } catch {}
    onChange?.(next);
  }
  return (
    <div className="langSwitch" aria-label="Language">
      {available.map(code => (
        <button key={code} className={code === locale ? 'active' : ''} onClick={() => pick(code)}>{code.toUpperCase()}</button>
      ))}
    </div>
  );
}
