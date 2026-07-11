import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import 'highlight.js/styles/github-dark.css';

import './globals.css';
import { siteUrl } from '@/lib/site';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Filipe Bojikian Rissi',
    template: '%s | Filipe Bojikian Rissi'
  },
  description: 'Modern bilingual portfolio for Filipe Bojikian Rissi.',
  icons: {
    icon: '/favicon.svg'
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
