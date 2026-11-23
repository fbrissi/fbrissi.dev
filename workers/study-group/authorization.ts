/** Roles from least to most privileged. A platform admin can do everything a group owner can (D7). */
export const roles = ['visitor', 'user', 'member', 'owner', 'platform_admin'] as const;
export type Role = (typeof roles)[number];

export function authorize(role: Role, required: Role): boolean {
  return roles.indexOf(role) >= roles.indexOf(required);
}

/** The caller's role outside any group. */
export function resolveRole(user: { id: string } | null, isPlatformAdmin: boolean): Role {
  if (!user) return 'visitor';
  return isPlatformAdmin ? 'platform_admin' : 'user';
}

/**
 * The caller's role inside a group. Owning the group wins over being a platform admin, so an admin acting on their own
 * group is an owner and needs no deletion reason; elsewhere the admin outranks membership.
 */
export function resolveGroupRole(
  user: { id: string } | null,
  isPlatformAdmin: boolean,
  group: { ownerId: string | null },
  isMember: boolean
): Role {
  if (!user) return 'visitor';
  if (group.ownerId === user.id) return 'owner';
  if (isPlatformAdmin) return 'platform_admin';
  return isMember ? 'member' : 'user';
}

export function isPlatformAdminEmail(email: string, allowlist: readonly string[]): boolean {
  const normalized = email.trim().toLowerCase();
  return allowlist.some((entry) => entry === normalized);
}

export function parseEmailAllowlist(value: string | undefined): string[] {
  return (value ?? '').split(',').map((entry) => entry.trim().toLowerCase()).filter(Boolean);
}
