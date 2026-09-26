import Script from 'next/script';
import './globals.css';
import TelegramBoot from '@/components/TelegramBoot';

export const metadata = {
  title: 'Технологія змін',
  description: '91 крок до управління власним життям'
};

export default function RootLayout({ children }) {
  return (
    <html lang="uk">
      <body>
        <Script src="https://telegram.org/js/telegram-web-app.js?63" strategy="beforeInteractive" />
        <TelegramBoot />
        {children}
      </body>
    </html>
  );
}
