import { z } from 'zod';
import { createAdminToken, timingSafeEqual, verifyAdminLogin, verifyAdminToken, type AdminCredentials } from './auth';
import {
  adminLoginSchema,
  castVoteSchema,
  createMaterialSchema,
  createRoundSchema,
  materialStatuses,
  STUDY_GROUP_ACCESS_CODE_HEADER,
  STUDY_GROUP_API_PREFIX,
  updateGroupSettingsSchema,
  updateMaterialSchema,
  type ErrorResponse,
  type Round,
  type RoundResponse,
} from './contract';
import { createRepository, isUniqueConstraintError, type D1Like, type StudyGroupRepository } from './repository';

export type RateLimitKind = 'read' | 'write' | 'login';

export interface StudyGroupHandlerDeps {
  db: D1Like;
  allowedOrigins: readonly string[];
  /** Admin login configuration; when absent every admin login fails. */
  admin?: AdminCredentials;
  /** Returns false when the request exceeds its rate limit. */
  rateLimit?: (kind: RateLimitKind, request: Request) => Promise<boolean>;
  now?: () => Date;
  /** Returns an integer in [0, max). */
  randomInt?: (max: number) => number;
}

class HttpError extends Error {
  constructor(readonly status: number, message: string, readonly issues?: unknown[]) {
    super(message);
  }
}

const listStatusSchema = z.enum([...materialStatuses, 'all']).default('all');

export function cryptoRandomInt(max: number): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] % max;
}

export function createHandler(deps: StudyGroupHandlerDeps) {
  const repository = createRepository(deps.db);
  const clock = () => deps.now?.() ?? new Date();
  const randomInt = deps.randomInt ?? cryptoRandomInt;
  const context: RouteContext = {
    repository,
    admin: deps.admin,
    clock,
    now: () => clock().toISOString(),
    pick: <T>(items: T[]): T => items[randomInt(items.length)],
  };

  return async function handle(request: Request): Promise<Response> {
    const headers = responseHeaders(request, deps.allowedOrigins);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });

    try {
      const pathname = new URL(request.url).pathname;
      if (pathname !== STUDY_GROUP_API_PREFIX && !pathname.startsWith(`${STUDY_GROUP_API_PREFIX}/`)) {
        throw new HttpError(404, 'Not found');
      }
      const segments = pathname.slice(STUDY_GROUP_API_PREFIX.length).split('/').filter(Boolean);
      const route = matchRoute(request.method, segments);

      const kind: RateLimitKind = route.access === 'login' ? 'login' : request.method === 'GET' ? 'read' : 'write';
      if (deps.rateLimit && !(await deps.rateLimit(kind, request))) throw new HttpError(429, 'Too many requests');

      if (route.access === 'member') await requireMember(request, repository);
      if (route.access === 'admin') await requireAdmin(request, context);

      const result = await route.run(request, context);
      if (result === null) return new Response(null, { status: 204, headers });
      return Response.json(result.body, { status: result.status, headers });
    } catch (error) {
      if (error instanceof HttpError) {
        const body: ErrorResponse = { error: error.message };
        if (error.issues) body.issues = error.issues;
        return Response.json(body, { status: error.status, headers });
      }
      console.error('Unable to handle study group request:', error);
      return Response.json({ error: 'Internal server error' } satisfies ErrorResponse, { status: 500, headers });
    }
  };
}

interface RouteContext {
  repository: StudyGroupRepository;
  admin: AdminCredentials | undefined;
  clock: () => Date;
  now: () => string;
  pick: <T>(items: T[]) => T;
}

type RouteResult = { status: number; body: object } | null;
type RouteRun = (request: Request, context: RouteContext) => Promise<RouteResult>;
type Access = 'member' | 'admin' | 'login';
interface Route {
  access: Access;
  run: RouteRun;
}

function matchRoute(method: string, segments: string[]): Route {
  const methods = (access: Access, routes: Record<string, RouteRun>): Route => {
    const run = routes[method];
    if (!run) throw new HttpError(405, 'Method not allowed');
    return { access, run };
  };

  if (segments[0] === 'admin') {
    const [, resource, rawId, action, ...rest] = segments;
    if (resource === 'login' && rawId === undefined) return methods('login', { POST: login });
    if (resource === 'settings' && rawId === undefined) return methods('admin', { GET: getSettings, PUT: updateSettings });
    if (resource === 'materials' && rawId === 'deleted' && action === undefined) {
      return methods('admin', { GET: listDeletedMaterials });
    }
    if (resource === 'materials' && action === 'restore' && rest.length === 0) {
      const id = parseId(rawId);
      return methods('admin', { POST: (_request, context) => restoreMaterial(id, context) });
    }
    throw new HttpError(404, 'Not found');
  }

  const [resource, rawId, action, ...rest] = segments;
  if (resource === 'group' && rawId === undefined) return methods('member', { GET: getGroupInfo });
  if (resource === 'materials' && rawId === undefined) {
    return methods('member', { GET: listMaterials, POST: createMaterial });
  }
  if (resource === 'materials' && action === undefined) {
    const id = parseId(rawId);
    return methods('member', {
      PATCH: (request, context) => updateMaterial(id, request, context),
      DELETE: (_request, context) => deleteMaterial(id, context),
    });
  }
  if (resource === 'rounds' && rawId === undefined) return methods('member', { POST: createRound });
  if (resource === 'rounds' && rawId === 'current' && action === undefined) return methods('member', { GET: getCurrentRound });
  if (resource === 'rounds' && rest.length === 0) {
    const id = parseId(rawId);
    if (action === 'votes') return methods('member', { POST: (request, context) => castVote(id, request, context) });
    if (action === 'close') return methods('member', { POST: (_request, context) => closeRound(id, context) });
    if (action === 'cancel') return methods('member', { POST: (_request, context) => cancelRound(id, context) });
  }
  throw new HttpError(404, 'Not found');
}

async function requireMember(request: Request, repository: StudyGroupRepository): Promise<void> {
  const provided = request.headers.get(STUDY_GROUP_ACCESS_CODE_HEADER) ?? '';
  const accessCode = await repository.getAccessCode();
  if (!accessCode || !timingSafeEqual(provided, accessCode)) throw new HttpError(401, 'access_code_required');
}

async function requireAdmin(request: Request, { admin, clock }: RouteContext): Promise<void> {
  const [scheme, token] = (request.headers.get('Authorization') ?? '').split(' ');
  const valid = scheme === 'Bearer' && Boolean(token) && await verifyAdminToken(token, admin?.sessionSecret ?? '', clock());
  if (!valid) throw new HttpError(401, 'unauthorized');
}

function parseId(value: string): number {
  if (!/^[1-9]\d{0,15}$/.test(value)) throw new HttpError(404, 'Not found');
  return Number(value);
}

async function parseBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
  const result = schema.safeParse(body);
  if (!result.success) throw new HttpError(400, 'Invalid request', result.error.issues);
  return result.data;
}

async function login(request: Request, { admin, clock }: RouteContext): Promise<RouteResult> {
  const input = await parseBody(request, adminLoginSchema);
  if (!admin?.sessionSecret || !(await verifyAdminLogin(input.email, input.password, admin))) {
    throw new HttpError(401, 'invalid_credentials');
  }
  return { status: 200, body: await createAdminToken(admin.sessionSecret, clock()) };
}

async function getSettings(_request: Request, { repository }: RouteContext): Promise<RouteResult> {
  const settings = await repository.getGroupSettings();
  if (!settings) throw new HttpError(404, 'Group settings not found');
  return { status: 200, body: { settings } };
}

async function updateSettings(request: Request, { repository }: RouteContext): Promise<RouteResult> {
  const input = await parseBody(request, updateGroupSettingsSchema);
  return { status: 200, body: { settings: await repository.updateGroupSettings(input) } };
}

async function listDeletedMaterials(_request: Request, { repository }: RouteContext): Promise<RouteResult> {
  return { status: 200, body: { materials: await repository.listDeletedMaterials() } };
}

async function restoreMaterial(id: number, { repository }: RouteContext): Promise<RouteResult> {
  try {
    const material = await repository.restoreMaterial(id);
    if (!material) throw new HttpError(404, 'Deleted material not found');
    return { status: 200, body: { material } };
  } catch (error) {
    if (isUniqueConstraintError(error)) throw new HttpError(409, 'This URL is already open in another suggestion');
    throw error;
  }
}

async function getGroupInfo(_request: Request, { repository }: RouteContext): Promise<RouteResult> {
  return { status: 200, body: { group: await repository.getGroupInfo() } };
}

async function listMaterials(request: Request, { repository }: RouteContext): Promise<RouteResult> {
  const status = listStatusSchema.safeParse(new URL(request.url).searchParams.get('status') ?? undefined);
  if (!status.success) throw new HttpError(400, 'Invalid status filter', status.error.issues);
  return { status: 200, body: { materials: await repository.listMaterials(status.data) } };
}

async function createMaterial(request: Request, { repository, now }: RouteContext): Promise<RouteResult> {
  const input = await parseBody(request, createMaterialSchema);
  try {
    return { status: 201, body: { material: await repository.createMaterial(input, now()) } };
  } catch (error) {
    if (isUniqueConstraintError(error)) throw new HttpError(409, 'This URL was already suggested');
    throw error;
  }
}

async function updateMaterial(id: number, request: Request, { repository, now }: RouteContext): Promise<RouteResult> {
  const input = await parseBody(request, updateMaterialSchema);
  try {
    const material = await repository.updateMaterialStatus(id, input.status, now());
    if (!material) throw new HttpError(404, 'Material not found');
    return { status: 200, body: { material } };
  } catch (error) {
    if (isUniqueConstraintError(error)) throw new HttpError(409, 'This URL is already open in another suggestion');
    throw error;
  }
}

async function deleteMaterial(id: number, { repository, now }: RouteContext): Promise<RouteResult> {
  if (!(await repository.getMaterial(id))) throw new HttpError(404, 'Material not found');
  await repository.deleteMaterial(id, now());
  return null;
}

async function getCurrentRound(_request: Request, { repository }: RouteContext): Promise<RouteResult> {
  const round = await repository.getCurrentRound();
  return { status: 200, body: { round, tally: round ? await repository.getTally(round.id) : [] } };
}

async function createRound(request: Request, { repository, now, pick }: RouteContext): Promise<RouteResult> {
  const { mode } = await parseBody(request, createRoundSchema);
  if (await repository.getCurrentRound().then((round) => round?.status === 'open')) {
    throw new HttpError(409, 'A round is already open');
  }
  const openMaterialIds = await repository.listOpenMaterialIds();
  if (openMaterialIds.length === 0) throw new HttpError(422, 'There are no open materials');

  try {
    const round = await repository.createRound(mode, now(), mode === 'draw' ? pick(openMaterialIds) : null);
    return { status: 201, body: await roundResponse(round, repository) };
  } catch (error) {
    if (isUniqueConstraintError(error)) throw new HttpError(409, 'A round is already open');
    throw error;
  }
}

async function castVote(roundId: number, request: Request, { repository, now }: RouteContext): Promise<RouteResult> {
  const input = await parseBody(request, castVoteSchema);
  const round = await requireRound(roundId, repository);
  if (round.status !== 'open') throw new HttpError(422, 'This round is closed');
  const material = await repository.getMaterial(input.materialId);
  if (!material) throw new HttpError(404, 'Material not found');
  if (material.status !== 'open') throw new HttpError(422, 'This material is not open for voting');

  await repository.castVote(round.id, material.id, input.voterName, now());
  return { status: 201, body: await roundResponse(round, repository) };
}

async function closeRound(roundId: number, { repository, now, pick }: RouteContext): Promise<RouteResult> {
  const round = await requireOpenRound(roundId, repository);
  const openIds = new Set(await repository.listOpenMaterialIds());
  const tally = (await repository.getTally(round.id)).filter((entry) => openIds.has(entry.materialId));

  let winnerMaterialId: number | null = null;
  if (tally.length > 0) {
    winnerMaterialId = pick(tally.filter((entry) => entry.votes === tally[0].votes)).materialId;
  } else {
    const eligible = await repository.listOpenMaterialIds(round.createdAt);
    if (eligible.length > 0) winnerMaterialId = pick(eligible);
  }

  return finishRound(round.id, winnerMaterialId, repository, now());
}

async function cancelRound(roundId: number, { repository, now }: RouteContext): Promise<RouteResult> {
  const round = await requireOpenRound(roundId, repository);
  return finishRound(round.id, null, repository, now());
}

async function finishRound(
  roundId: number,
  winnerMaterialId: number | null,
  repository: StudyGroupRepository,
  closedAt: string
): Promise<RouteResult> {
  const closed = await repository.closeRound(roundId, closedAt, winnerMaterialId);
  if (!closed) throw new HttpError(409, 'This round is already closed');
  return { status: 200, body: await roundResponse(closed, repository) };
}

async function requireRound(id: number, repository: StudyGroupRepository): Promise<Round> {
  const round = await repository.getRound(id);
  if (!round) throw new HttpError(404, 'Round not found');
  return round;
}

async function requireOpenRound(id: number, repository: StudyGroupRepository): Promise<Round> {
  const round = await requireRound(id, repository);
  if (round.status !== 'open') throw new HttpError(409, 'This round is already closed');
  return round;
}

async function roundResponse(round: Round, repository: StudyGroupRepository): Promise<RoundResponse> {
  const [winner, tally] = await Promise.all([
    round.winnerMaterialId === null ? null : repository.getMaterial(round.winnerMaterialId),
    repository.getTally(round.id),
  ]);
  return { round, winner, tally };
}

function responseHeaders(request: Request, allowedOrigins: readonly string[]): Headers {
  const origin = request.headers.get('Origin');
  return new Headers({
    'Access-Control-Allow-Origin': origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': `Content-Type, Authorization, ${STUDY_GROUP_ACCESS_CODE_HEADER}`,
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
    'X-Robots-Tag': 'noindex, nofollow',
  });
}
