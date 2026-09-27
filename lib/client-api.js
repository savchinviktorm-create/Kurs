'use client';

function getTelegramInitData() {
  if (typeof window === 'undefined') return '';
  return window.Telegram?.WebApp?.initData || '';
}

export async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('x-telegram-init-data', getTelegramInitData());
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (options.body && !isFormData && !headers.has('content-type')) headers.set('content-type', 'application/json');

  const res = await fetch(path, { ...options, headers, cache: 'no-store' });
  const data = await res.json().catch(() => ({ ok: false, error: 'INVALID_SERVER_RESPONSE' }));
  if (!res.ok || data.ok === false) {
    const err = new Error(data.error || `HTTP_${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export function openTelegramInvoice(url, onDone) {
  const webApp = window.Telegram?.WebApp;
  if (webApp?.openInvoice) {
    webApp.openInvoice(url, (status) => onDone?.(status));
  } else {
    window.location.href = url;
  }
}

export function haptic(type = 'light') {
  try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(type); } catch {}
}
