import {
  STUDY_GROUP_ACCESS_CODE_HEADER,
  STUDY_GROUP_API_PREFIX,
  type AdminLoginInput,
  type AdminLoginResponse,
  type CastVoteInput,
  type CreateMaterialInput,
  type CreateRoundInput,
  type CurrentRoundResponse,
  type ErrorResponse,
  type GroupInfoResponse,
  type GroupSettingsResponse,
  type ListDeletedMaterialsResponse,
  type ListMaterialsResponse,
  type MaterialResponse,
  type RoundResponse,
  type UpdateGroupSettingsInput,
  type UpdateMaterialInput
} from '@/workers/study-group/contract';

export const defaultStudyGroupApiUrl = STUDY_GROUP_API_PREFIX;

export class StudyGroupApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'StudyGroupApiError';
  }
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof StudyGroupApiError && error.status === 401;
}

function createRequester(baseUrl: string, authHeaders: () => Record<string, string>) {
  const root = baseUrl.replace(/\/+$/, '');

  return async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json', ...authHeaders() };
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const response = await fetch(`${root}${path}`, {
      method,
      cache: 'no-store',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });

    if (response.status === 204) return undefined as T;

    const payload = (await response.json().catch(() => null)) as T | ErrorResponse | null;
    if (!response.ok) {
      throw new StudyGroupApiError(response.status, (payload as ErrorResponse | null)?.error ?? `Request failed with status ${response.status}`);
    }

    return payload as T;
  };
}

export function createStudyGroupApi(baseUrl: string, accessCode: () => string) {
  const request = createRequester(baseUrl, () => ({ [STUDY_GROUP_ACCESS_CODE_HEADER]: accessCode() }));

  return {
    getGroup: () => request<GroupInfoResponse>('/group'),
    listMaterials: () => request<ListMaterialsResponse>('/materials?status=all'),
    createMaterial: (input: CreateMaterialInput) => request<MaterialResponse>('/materials', 'POST', input),
    updateMaterial: (id: number, input: UpdateMaterialInput) => request<MaterialResponse>(`/materials/${id}`, 'PATCH', input),
    deleteMaterial: (id: number) => request<void>(`/materials/${id}`, 'DELETE'),
    getCurrentRound: () => request<CurrentRoundResponse>('/rounds/current'),
    createRound: (input: CreateRoundInput) => request<RoundResponse>('/rounds', 'POST', input),
    castVote: (roundId: number, input: CastVoteInput) => request<RoundResponse>(`/rounds/${roundId}/votes`, 'POST', input),
    closeRound: (roundId: number) => request<RoundResponse>(`/rounds/${roundId}/close`, 'POST'),
    cancelRound: (roundId: number) => request<RoundResponse>(`/rounds/${roundId}/cancel`, 'POST')
  };
}

export function createStudyGroupAdminApi(baseUrl: string, token: () => string) {
  const request = createRequester(baseUrl, (): Record<string, string> => {
    const value = token();
    return value ? { Authorization: `Bearer ${value}` } : {};
  });

  return {
    login: (input: AdminLoginInput) => request<AdminLoginResponse>('/admin/login', 'POST', input),
    getSettings: () => request<GroupSettingsResponse>('/admin/settings'),
    updateSettings: (input: UpdateGroupSettingsInput) => request<GroupSettingsResponse>('/admin/settings', 'PUT', input),
    listDeletedMaterials: () => request<ListDeletedMaterialsResponse>('/admin/materials/deleted'),
    restoreMaterial: (id: number) => request<MaterialResponse>(`/admin/materials/${id}/restore`, 'POST')
  };
}

export type StudyGroupApi = ReturnType<typeof createStudyGroupApi>;
export type StudyGroupAdminApi = ReturnType<typeof createStudyGroupAdminApi>;

export function errorMessage(error: unknown): string {
  return error instanceof StudyGroupApiError ? error.message : 'Something went wrong. Please try again.';
}
