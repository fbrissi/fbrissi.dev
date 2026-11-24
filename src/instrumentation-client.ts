import { startBrowserSentry } from '@/lib/sentry-browser';

void startBrowserSentry().catch(() => undefined);
