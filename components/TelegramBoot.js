'use client';
import { useEffect } from 'react';

export default function TelegramBoot() {
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;
    tg.ready();
    tg.expand();
    try { tg.setHeaderColor('#fffaf1'); } catch {}
    try { tg.setBackgroundColor('#fffaf1'); } catch {}
  }, []);
  return null;
}
