import { z } from 'zod';
import {
  castVoteSchema,
  createMaterialSchema,
  createRoundSchema,
  deleteSchema,
  LIMITS,
  materialStatuses,
  updateMaterialSchema,
  type CurrentRoundResponse,
  type Round,
  type RoundResponse,
} from './contract';
import { adminLog, requireId } from './group-routes';
import { HttpError, now, parseBody, type GroupContext, type RouteResult } from './http';
import { isUniqueConstraintError } from './repository';

const listStatusSchema = z.enum([...materialStatuses, 'all']).default('all');
const DAY_MS = 24 * 60 * 60 * 1000;

function canModerate(context: GroupContext): boolean {
  return context.role === 'owner' || context.role === 'platform_admin';
}

function rethrowDuplicate(error: unknown, message: string): never {
  if (isUniqueConstraintError(error)) throw new HttpError(409, message);
  throw error;
}

export async function listMaterials(context: GroupContext): Promise<RouteResult> {
  const status = listStatusSchema.safeParse(context.url.searchParams.get('status') ?? undefined);
  if (!status.success) throw new HttpError(400, 'Invalid status filter', status.error.issues);
  const materials = await context.app.repository.listMaterials(context.group.id, context.user.id, canModerate(context));
  return { status: 200, body: { materials: status.data === 'all' ? materials : materials.filter((item) => item.status === status.data) } };
}

/** In review mode members' suggestions wait for the owner; the owner's own suggestions skip review (Q15). */
export async function createMaterial(context: GroupContext): Promise<RouteResult> {
  const input = await parseBody(context.request, createMaterialSchema);
  const { group, user, app } = context;
  const since = new Date(app.clock().getTime() - DAY_MS).toISOString();
  if ((await app.repository.countRecentSuggestions(group.id, user.id, since)) >= LIMITS.suggestionsPerUserPerGroupPerDay) {
    throw new HttpError(429, `You can suggest at most ${LIMITS.suggestionsPerUserPerGroupPerDay} materials per day in a group`);
  }
  const status = group.moderationMode === 'review' && !canModerate(context) ? 'pending' : 'open';
  try {
    return { status: 201, body: { material: await app.repository.createMaterial(group.id, user, input, status, now(context)) } };
  } catch (error) {
    rethrowDuplicate(error, 'This URL was already suggested');
  }
}

export async function updateMaterial(context: GroupContext): Promise<RouteResult> {
  const input = await parseBody(context.request, updateMaterialSchema);
  try {
    const material = await context.app.repository.setMaterialStatus(context.group.id, requireId(context.params.materialId), input.status, now(context), context.user.id);
    if (!material) throw new HttpError(404, 'Material not found');
    return { status: 200, body: { material } };
  } catch (error) {
    rethrowDuplicate(error, 'This URL is already open in another suggestion');
  }
}

export async function approveMaterial(context: GroupContext): Promise<RouteResult> {
  const material = await context.app.repository.approveMaterial(context.group.id, requireId(context.params.materialId), context.user.id);
  if (!material) throw new HttpError(404, 'Pending material not found');
  return { status: 200, body: { material } };
}

export async function deleteMaterial(context: GroupContext): Promise<RouteResult> {
  const { reason } = await parseBody(context.request, deleteSchema);
  const id = requireId(context.params.materialId);
  const material = await context.app.repository.getMaterial(context.group.id, id, context.user.id);
  if (!material) throw new HttpError(404, 'Material not found');
  const log = adminLog(context, reason, { action: 'delete_material', targetType: 'material', targetId: String(id), label: material.title });
  await context.app.repository.deleteMaterial(context.group.id, id, now(context), log);
  return null;
}

async function roundResponse(context: GroupContext, round: Round): Promise<RoundResponse> {
  const { repository } = context.app;
  const [winner, tally, myVote] = await Promise.all([
    round.winnerMaterialId === null ? null : repository.getMaterial(context.group.id, round.winnerMaterialId, context.user.id),
    repository.getTally(round.id),
    repository.getMyVote(round.id, context.user.id),
  ]);
  return { round, winner, tally, myVote };
}

export async function getCurrentRound(context: GroupContext): Promise<RouteResult> {
  const round = await context.app.repository.getCurrentRound(context.group.id);
  const body: CurrentRoundResponse = round ? await roundResponse(context, round) : { round: null, tally: [], myVote: null };
  return { status: 200, body };
}

export async function createRound(context: GroupContext): Promise<RouteResult> {
  const { mode } = await parseBody(context.request, createRoundSchema);
  const { repository, pick } = context.app;
  const groupId = context.group.id;
  if ((await repository.getCurrentRound(groupId))?.status === 'open') throw new HttpError(409, 'A round is already open');
  const openMaterialIds = await repository.listOpenMaterialIds(groupId);
  if (openMaterialIds.length === 0) throw new HttpError(422, 'There are no open materials');
  if (mode === 'vote' && openMaterialIds.length < 2) throw new HttpError(422, 'A vote needs at least 2 open materials');

  try {
    const round = await repository.createRound(groupId, mode, now(context), mode === 'draw' ? pick(openMaterialIds) : null);
    return { status: 201, body: await roundResponse(context, round) };
  } catch (error) {
    rethrowDuplicate(error, 'A round is already open');
  }
}

async function requireRound(context: GroupContext): Promise<Round> {
  const round = await context.app.repository.getRound(context.group.id, requireId(context.params.roundId));
  if (!round) throw new HttpError(404, 'Round not found');
  return round;
}

async function requireOpenRound(context: GroupContext): Promise<Round> {
  const round = await requireRound(context);
  if (round.status !== 'open') throw new HttpError(409, 'This round is already closed');
  return round;
}

/** Each user has one vote per round and can move it until the round closes. */
export async function castVote(context: GroupContext): Promise<RouteResult> {
  const input = await parseBody(context.request, castVoteSchema);
  const round = await requireRound(context);
  if (round.status !== 'open') throw new HttpError(422, 'This round is closed');
  const { repository } = context.app;
  const material = await repository.getMaterial(context.group.id, input.materialId, context.user.id);
  if (!material) throw new HttpError(404, 'Material not found');
  if (material.status !== 'open') throw new HttpError(422, 'This material is not open for voting');

  await repository.castVote(context.group.id, round.id, material.id, context.user, now(context));
  return { status: 201, body: await roundResponse(context, round) };
}

export async function closeRound(context: GroupContext): Promise<RouteResult> {
  const round = await requireOpenRound(context);
  const { repository, pick } = context.app;
  const openIds = new Set(await repository.listOpenMaterialIds(context.group.id));
  const tally = (await repository.getTally(round.id)).filter((entry) => openIds.has(entry.materialId));

  let winnerMaterialId: number | null = null;
  if (tally.length > 0) {
    winnerMaterialId = pick(tally.filter((entry) => entry.votes === tally[0].votes)).materialId;
  } else {
    const eligible = await repository.listOpenMaterialIds(context.group.id, round.createdAt);
    if (eligible.length > 0) winnerMaterialId = pick(eligible);
  }
  return finishRound(context, round.id, winnerMaterialId);
}

export async function cancelRound(context: GroupContext): Promise<RouteResult> {
  const round = await requireOpenRound(context);
  return finishRound(context, round.id, null);
}

async function finishRound(context: GroupContext, roundId: number, winnerMaterialId: number | null): Promise<RouteResult> {
  const closed = await context.app.repository.closeRound(context.group.id, roundId, now(context), winnerMaterialId);
  if (!closed) throw new HttpError(409, 'This round is already closed');
  return { status: 200, body: await roundResponse(context, closed) };
}
