import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { siteUrl } from '@/lib/site';

import '../../index.css';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Filipe Bojikian Rissi | Staff Software Engineer',
  icons: {
    icon: [
      { url: '/images/icons/favicon.ico', sizes: 'any' },
      { url: '/images/icons/favicon-32.png', type: 'image/png', sizes: '32x32' },
      { url: '/images/icons/favicon-16.png', type: 'image/png', sizes: '16x16' }
    ],
    apple: '/images/icons/apple-touch-icon.png'
  },
  description: 'Staff Software Engineer and Senior Backend Engineer with 15+ years of experience in distributed systems, cloud architecture, AWS, Kubernetes and microservices.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
