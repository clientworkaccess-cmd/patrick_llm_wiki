import type { Metadata } from 'next';
import { Manrope, Instrument_Serif, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });
const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: 'italic',
  variable: '--font-instrument-serif',
  display: 'swap',
});
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'Knowledge Graph',
  description: 'A wiki your documents write themselves into.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${instrumentSerif.variable} ${jetbrains.variable}`}>
      <body className="min-h-[100dvh] bg-base">{children}</body>
    </html>
  );
}
