import Script from 'next/script';
import './globals.css';
import TelegramBoot from '@/components/TelegramBoot';

export const metadata = {
  title: 'Курси — Telegram Mini App',
  description: 'Універсальна платформа курсів у Telegram'
};

export default function RootLayout({ children }) {
  return <html lang="uk"><body><Script src="https://telegram.org/js/telegram-web-app.js?63" strategy="beforeInteractive"/><TelegramBoot/>{children}</body></html>;
}
