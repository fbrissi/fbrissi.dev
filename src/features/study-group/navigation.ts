/** Full-page navigations (sign-in, sign-out and created resources reload the session on the next page). */
export function navigate(path: string): void {
  window.location.assign(path);
}

export function currentPath(): string {
  return window.location.pathname;
}
