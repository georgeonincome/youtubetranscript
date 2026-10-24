import '../styles/globals.css';
import type { Metadata } from 'next';
import { Figtree, Geist_Mono, Newsreader } from 'next/font/google';

const figtree = Figtree({
  subsets: ['latin'],
  variable: '--font-figtree',
  display: 'swap',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
});

const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-newsreader',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Free YouTube Transcript Generator',
  description:
    "Generate transcripts for any YouTube video. Read online or download the video text for later, all without needing to sign up!",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${figtree.variable} ${geistMono.variable} ${newsreader.variable}`}>
      <body className="bg-[#1c172e] text-white min-h-screen font-sans">
        {children}
      </body>
    </html>
  );
}
