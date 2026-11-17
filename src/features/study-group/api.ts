import {
  STUDY_GROUP_API_PREFIX,
  type AcceptPoliciesInput,
  type AdminGroupListResponse,
  type CastVoteInput,
  type CreateGroupInput,
  type CreateGroupResponse,
  type CreateMaterialInput,
  type CreateRoundInput,
  type CurrentRoundResponse,
  type DeleteGroupInput,
  type ErrorResponse,
  type GroupListResponse,
  type GroupPreviewResponse,
  type GroupProfileInput,
  type GroupResponse,
  type GroupSettingsResponse,
  type JoinGroupInput,
  type JoinRequestsResponse,
  type JoinResponse,
  type ListDeletedMaterialsResponse,
  type ListMaterialsResponse,
  type MaterialResponse,
  type MeResponse,
  type MembersResponse,
  type ModerationLogResponse,
  type MyGroupsResponse,
  type PendingSignupResponse,
  type RoundResponse,
  type SignupInput,
  type UpdateMaterialInput,
  type UpdateProfileInput
} from '@/workers/study-group/contract';

export const defaultStudyGroupApiUrl = STUDY_GROUP_API_PREFIX;

export class StudyGroupApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'StudyGroupApiError';
  }
}

export function hasStatus(error: unknown, status: number): boolean {
  return error instanceof StudyGroupApiError && error.status === status;
}

export function isUnauthorized(error: unknown): boolean {
  return hasStatus(error, 401);
}

export function isConsentRequired(error: unknown): boolean {
  return hasStatus(error, 403) && (error as StudyGroupApiError).message === 'consent_required';
}

/** Sign-in is a top-level navigation to the same-origin API, which redirects to Google and back to `returnTo`. */
export function signInHref(returnTo: string): string {
  return `${STUDY_GROUP_API_PREFIX}/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
}

export function groupPath(id: string, page: '' | '/settings' = ''): string {
  return `/study-groups/g/${encodeURIComponent(id)}${page}`;
}

function query(params: Record<string, string | null | undefined>): string {
  const search = new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1])));
  const value = search.toString();
  return value ? `?${value}` : '';
}

export function createStudyGroupApi(baseUrl: string = defaultStudyGroupApiUrl) {
  const root = baseUrl.replace(/\/+$/, '');

  // The session cookie is HttpOnly and same-origin; every state-changing call sends JSON (the API's CSRF check).
  async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (method !== 'GET') headers['Content-Type'] = 'application/json';

    const response = await fetch(`${root}${path}`, {
      method,
      cache: 'no-store',
      credentials: 'same-origin',
      headers,
      body: method === 'GET' ? undefined : JSON.stringify(body ?? {})
    });

    if (response.status === 204) return undefined as T;

    const payload = (await response.json().catch(() => null)) as T | ErrorResponse | null;
    if (!response.ok) {
      throw new StudyGroupApiError(response.status, (payload as ErrorResponse | null)?.error ?? `Request failed with status ${response.status}`);
    }

    return payload as T;
  }

  const group = (id: string) => `/groups/${encodeURIComponent(id)}`;

  return {
    getMe: () => request<MeResponse>('/me'),
    updateMe: (input: UpdateProfileInput) => request<MeResponse>('/me', 'PATCH', input),
    deleteMe: () => request<void>('/me', 'DELETE', { confirm: true }),
    acceptPolicies: (input: AcceptPoliciesInput) => request<MeResponse>('/me/consents', 'POST', input),
    myGroups: () => request<MyGroupsResponse>('/me/groups'),
    exportUrl: () => `${root}/me/export`,
    logout: () => request<void>('/auth/logout', 'POST'),
    getSignup: () => request<PendingSignupResponse>('/auth/signup'),
    completeSignup: (input: SignupInput) => request<{ returnTo: string }>('/auth/signup', 'POST', input),
    cancelSignup: () => request<void>('/auth/signup/cancel', 'POST'),

    listGroups: (cursor?: string | null) => request<GroupListResponse>(`/groups${query({ cursor })}`),
    createGroup: (input: CreateGroupInput) => request<CreateGroupResponse>('/groups', 'POST', input),
    previewGroup: (id: string) => request<GroupPreviewResponse>(`${group(id)}/preview`),
    joinGroup: (id: string, input: JoinGroupInput) => request<JoinResponse>(`${group(id)}/join`, 'POST', input),
    getGroup: (id: string) => request<GroupResponse>(group(id)),
    deleteGroup: (id: string, input: DeleteGroupInput) => request<void>(group(id), 'DELETE', input),
    listMembers: (id: string) => request<MembersResponse>(`${group(id)}/members`),
    removeMember: (id: string, userId: string) => request<void>(`${group(id)}/members/${encodeURIComponent(userId)}`, 'DELETE'),
    leaveGroup: (id: string) => request<void>(`${group(id)}/leave`, 'POST'),
    getSettings: (id: string) => request<GroupSettingsResponse>(`${group(id)}/settings`),
    updateSettings: (id: string, input: GroupProfileInput) => request<GroupSettingsResponse>(`${group(id)}/settings`, 'PUT', input),
    rotateAccessCode: (id: string) => request<GroupSettingsResponse>(`${group(id)}/access-code`, 'POST'),
    listRequests: (id: string) => request<JoinRequestsResponse>(`${group(id)}/requests`),
    approveRequest: (id: string, requestId: number) => request<void>(`${group(id)}/requests/${requestId}/approve`, 'POST'),
    rejectRequest: (id: string, requestId: number) => request<void>(`${group(id)}/requests/${requestId}/reject`, 'POST'),
    deleteRequestMessage: (id: string, requestId: number, reason: string) => request<void>(`${group(id)}/requests/${requestId}/message`, 'DELETE', { reason }),

    listMaterials: (id: string) => request<ListMaterialsResponse>(`${group(id)}/materials?status=all`),
    createMaterial: (id: string, input: CreateMaterialInput) => request<MaterialResponse>(`${group(id)}/materials`, 'POST', input),
    updateMaterial: (id: string, materialId: number, input: UpdateMaterialInput) => request<MaterialResponse>(`${group(id)}/materials/${materialId}`, 'PATCH', input),
    approveMaterial: (id: string, materialId: number) => request<MaterialResponse>(`${group(id)}/materials/${materialId}/approve`, 'POST'),
    deleteMaterial: (id: string, materialId: number, reason?: string) => request<void>(`${group(id)}/materials/${materialId}`, 'DELETE', reason ? { reason } : {}),
    listDeletedMaterials: (id: string) => request<ListDeletedMaterialsResponse>(`${group(id)}/materials/deleted`),
    restoreMaterial: (id: string, materialId: number) => request<MaterialResponse>(`${group(id)}/materials/${materialId}/restore`, 'POST'),
    getCurrentRound: (id: string) => request<CurrentRoundResponse>(`${group(id)}/rounds/current`),
    createRound: (id: string, input: CreateRoundInput) => request<RoundResponse>(`${group(id)}/rounds`, 'POST', input),
    castVote: (id: string, roundId: number, input: CastVoteInput) => request<RoundResponse>(`${group(id)}/rounds/${roundId}/votes`, 'POST', input),
    closeRound: (id: string, roundId: number) => request<RoundResponse>(`${group(id)}/rounds/${roundId}/close`, 'POST'),
    cancelRound: (id: string, roundId: number) => request<RoundResponse>(`${group(id)}/rounds/${roundId}/cancel`, 'POST'),

    adminGroups: (cursor?: string | null) => request<AdminGroupListResponse>(`/admin/groups${query({ cursor })}`),
    moderationLog: (cursor?: string | null) => request<ModerationLogResponse>(`/admin/moderation-log${query({ cursor })}`)
  };
}

export type StudyGroupApi = ReturnType<typeof createStudyGroupApi>;

export function errorMessage(error: unknown): string {
  if (isConsentRequired(error)) return 'Accept the updated Terms and Privacy Policy to make changes.';
  return error instanceof StudyGroupApiError ? error.message : 'Something went wrong. Please try again.';
}
