import type { ReactNode } from 'react';

import type { MaterialType } from '@/workers/study-group/contract';

const buttonBase = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg font-light tracking-wide transition-all duration-250 disabled:cursor-not-allowed disabled:opacity-50';

export const buttonClass = {
  primary: `${buttonBase} bg-accent px-6 py-3 text-bg hover:bg-accent-hover hover:shadow-lg hover:shadow-accent-glow disabled:hover:bg-accent disabled:hover:shadow-none`,
  primarySmall: `${buttonBase} bg-accent px-4 py-2 text-sm text-bg hover:bg-accent-hover hover:shadow-lg hover:shadow-accent-glow disabled:hover:bg-accent disabled:hover:shadow-none`,
  secondarySmall: `${buttonBase} border border-line bg-bg px-4 py-2 text-sm hover:border-accent hover:text-accent disabled:hover:border-line disabled:hover:text-text`,
  ghost: `${buttonBase} px-3 py-2 text-sm text-text-secondary hover:text-accent`,
  dangerGhost: `${buttonBase} px-3 py-2 text-sm text-text-secondary hover:text-red-500`
};

export const inputClass = 'w-full rounded-lg border border-line bg-bg px-4 py-3 font-light tracking-wide transition-all duration-250 placeholder:text-text-muted focus:border-accent focus:outline-hidden focus:ring-2 focus:ring-accent/20 aria-invalid:border-red-500';

export const cardClass = 'rounded-xl border border-line bg-bg-soft shadow-lg';

export const eyebrowClass = 'text-xs uppercase tracking-widest text-text-muted';

export const hintClass = 'text-[13px] text-text-muted';

const typeIcons: Record<MaterialType, ReactNode> = {
  video: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="m10 9 5 3-5 3z" /></>,
  article: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6M8 13h8M8 17h5" /></>,
  book: <><path d="M4 19.5V5a2 2 0 0 1 2-2h14v16H6.5A2.5 2.5 0 0 0 4 21.5" /><path d="M20 19v3H6.5" /></>,
  podcast: <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v4" /></>,
  other: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
};

export function TypeBadge({ type }: { type: MaterialType }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-bg-card px-2.5 py-1 text-xs capitalize tracking-wide text-text-secondary">
      <svg className="h-3.5 w-3.5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">{typeIcons[type]}</svg>
      {type}
    </span>
  );
}

export function ExternalLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className={className}>
      {children}
      <span className="ml-0.5 text-[13px] text-text-muted" aria-hidden="true"> ↗</span>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

export function Banner({ tone, title, children }: { tone: 'success' | 'error'; title: string; children?: ReactNode }) {
  const success = tone === 'success';
  return (
    <div role={success ? 'status' : 'alert'} className={`flex items-start gap-3 rounded-[10px] border px-4 py-3.5 text-sm ${success ? 'border-green-500 bg-green-500/10' : 'border-red-500 bg-red-500/10'}`}>
      <svg className={`h-5 w-5 shrink-0 ${success ? 'text-green-500' : 'text-red-500'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path d={success ? 'M5 13l4 4L19 7' : 'M6 18 18 6M6 6l12 12'} />
      </svg>
      <div className="flex flex-col gap-1">
        <p>{title}</p>
        {children}
      </div>
    </div>
  );
}

export function StateCard({ tone = 'accent', dashed = false, icon, title, text, action, role }: { tone?: 'accent' | 'error'; dashed?: boolean; icon: ReactNode; title: string; text: string; action: ReactNode; role?: 'alert' }) {
  return (
    <div role={role} className={`flex flex-col items-center gap-3 rounded-xl border border-line px-6 py-10 text-center ${dashed ? 'border-dashed' : 'bg-bg-soft shadow-lg'}`}>
      <div className={`flex h-16 w-16 items-center justify-center rounded-full ${tone === 'error' ? 'bg-red-500/10 text-red-500' : 'bg-accent/10 text-accent'}`}>
        <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">{icon}</svg>
      </div>
      <h3 className="text-[22px] font-normal tracking-tight">{title}</h3>
      <p className="max-w-md text-text-secondary">{text}</p>
      {action}
    </div>
  );
}
