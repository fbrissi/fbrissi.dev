import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { siteUrl } from '@/lib/site';

import '../index.css';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Filipe Bojikian Rissi | Portfolio',
  description: 'Staff Software Engineer and Senior Backend Engineer with 15+ years of experience in distributed systems, cloud architecture, AWS, Kubernetes and microservices.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
