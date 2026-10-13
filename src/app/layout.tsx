import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { getLocale, type Locale } from "@/i18n";

export const metadata: Metadata = {
  title: "GenISP — Billing & Network Automation",
  description: "Platform billing, pembayaran, dan otomasi jaringan untuk ISP. Cepat, bersih, tanpa license.",
};

/**
 * Script boot anti-FOUC: berjalan sebelum render pertama.
 * 1. Tema: baca localStorage 'theme' → cookie 'theme' → prefers-color-scheme,
 *    lalu pasang class `dark` di <html> (Tailwind darkMode: "class").
 * 2. Bahasa: baca cookie 'locale' → tulis window.__LOCALE__ agar client
 *    component tahu locale tanpa flash bahasa saat hydration.
 */
const BOOT_SCRIPT = `(function(){try{
var t=null;try{t=localStorage.getItem('theme');}catch(e){}
if(t!=='dark'&&t!=='light'){var m=document.cookie.match(/(?:^|; )theme=(dark|light)/);t=m?m[1]:null;}
if(t!=='dark'&&t!=='light'){t=(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';}
if(t==='dark')document.documentElement.classList.add('dark');
document.documentElement.style.colorScheme=t;
var l=(document.cookie.match(/(?:^|; )locale=(id|en)/)||[])[1]||'id';
window.__LOCALE__=l;
document.documentElement.lang=l;
}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const locale: Locale = getLocale(cookies().toString());
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
