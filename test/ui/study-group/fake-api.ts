import { vi } from 'vitest';

import type { CurrentUser, GroupInfo, Material, Round } from '@/workers/study-group/contract';

type RouteHandler = (body: Record<string, unknown> | undefined, url: URL) => unknown;
export type Routes = Record<string, unknown>;

/** Routes are keyed by `METHOD /path` (relative to /api/study-group, query string optional). */
export function stubApi(routes: Routes) {
  const fetchMock = vi.fn(async (input: string, init: RequestInit = {}) => {
    const url = new URL(input, 'http://localhost');
    const path = url.pathname.replace(/^\/api\/study-group/, '');
    const method = init.method ?? 'GET';
    const route = routes[`${method} ${path}${url.search}`] ?? routes[`${method} ${path}`];
    if (route === undefined) return Response.json({ error: `No stub for ${method} ${path}` }, { status: 404 });
    const result = typeof route === 'function' ? await (route as RouteHandler)(init.body ? JSON.parse(init.body as string) : undefined, url) : route;
    if (result instanceof Response) return result;
    if (result === null) return new Response(null, { status: 204 });
    return Response.json(result);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export function apiError(status: number, error: string): Response {
  return Response.json({ error }, { status });
}

/** A route that never resolves, to observe loading states. */
export function pending(): () => Promise<never> {
  return () => new Promise<never>(() => undefined);
}

export function calls(fetchMock: ReturnType<typeof stubApi>): string[] {
  return fetchMock.mock.calls.map(([input, init]) => `${(init as RequestInit | undefined)?.method ?? 'GET'} ${String(input).replace(/^\/api\/study-group/, '')}`);
}

export function bodyOf(fetchMock: ReturnType<typeof stubApi>, key: string): unknown {
  const call = fetchMock.mock.calls.find(([input, init]) => `${(init as RequestInit | undefined)?.method ?? 'GET'} ${String(input).replace(/^\/api\/study-group/, '')}` === key);
  return call ? JSON.parse((call[1] as RequestInit).body as string) : undefined;
}

export const user: CurrentUser = { id: 'user0001', displayName: 'Olivia', isPlatformAdmin: false, needsConsent: false };
export const admin: CurrentUser = { id: 'admin001', displayName: 'Ada', isPlatformAdmin: true, needsConsent: false };

export const group: GroupInfo = {
  id: 'gotalk1234',
  name: 'Go Talk',
  summary: 'Weekly English practice about Go and cloud tools.',
  rules: ["Don't speak in Portuguese", 'Be kind'],
  meetingDay: 'Monday',
  meetingStart: '20:00',
  meetingEnd: '21:00',
  timezone: 'America/Sao_Paulo',
  meetingUrl: 'https://meet.example.com/abc',
  moderationMode: 'free',
  listed: true
};

export function material(id: number, overrides: Partial<Material> = {}): Material {
  return { id, suggestedBy: `Person ${id}`, mine: false, type: 'video', title: `Material ${id}`, url: null, notes: null, status: 'open', createdAt: '2026-11-01T12:00:00Z', discussedAt: null, ...overrides };
}

export const votingRound: Round = { id: 7, mode: 'vote', status: 'open', createdAt: '2026-11-10T20:00:00Z', closedAt: null, winnerMaterialId: null };
export const closedRound: Round = { ...votingRound, status: 'closed', closedAt: '2026-11-10T21:00:00Z', winnerMaterialId: 1 };
