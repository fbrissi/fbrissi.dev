import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { siteUrl } from '@/lib/site';

import '../../index.css';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Filipe Bojikian Rissi | Especialista em Engenharia de Software',
  icons: {
    icon: [
      { url: '/images/icons/favicon.ico', sizes: 'any' },
      { url: '/images/icons/favicon-32.png', type: 'image/png', sizes: '32x32' },
      { url: '/images/icons/favicon-16.png', type: 'image/png', sizes: '16x16' }
    ],
    apple: '/images/icons/apple-touch-icon.png'
  },
  description: 'Especialista em Engenharia de Software e Engenheiro Backend Sênior com mais de 15 anos de experiência em sistemas distribuídos, arquitetura cloud, AWS, Kubernetes e microsserviços.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
