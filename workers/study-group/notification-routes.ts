import { emailPreferencesSchema, type EmailPreferencesResponse } from './contract';
import { HttpError, now, parseBody, redirect, type RequestContext, type RouteResult, type UserContext } from './http';
import { verifyUnsubscribeToken } from './unsubscribe';

export async function getPreferences(context: UserContext): Promise<RouteResult> {
  return { status: 200, body: { emailEnabled: await context.app.repository.getEmailEnabled(context.user.id) } satisfies EmailPreferencesResponse };
}

/** Turning email off or on is allowed even before accepting a new policy version. */
export async function updatePreferences(context: UserContext): Promise<RouteResult> {
  const { emailEnabled } = await parseBody(context.request, emailPreferencesSchema);
  await context.app.repository.setEmailEnabled(context.user.id, emailEnabled, now(context));
  return { status: 200, body: { emailEnabled } satisfies EmailPreferencesResponse };
}

/** A GET never unsubscribes (link scanners open it); it sends the person to the confirmation page. */
export async function unsubscribePage(context: RequestContext): Promise<RouteResult> {
  const token = context.url.searchParams.get('t') ?? '';
  return redirect(`${context.app.appOrigin}/study-groups/unsubscribe?t=${encodeURIComponent(token)}`);
}

/**
 * One-click unsubscribe (RFC 8058): the signed token in the URL is the only credential, so the body (usually
 * `List-Unsubscribe=One-Click`) is ignored and no session or Origin is needed.
 */
export async function unsubscribe(context: RequestContext): Promise<RouteResult> {
  const { app } = context;
  const userId = await verifyUnsubscribeToken(context.url.searchParams.get('t') ?? '', app.environment, app.unsubscribeSecret, app.clock());
  if (!userId) throw new HttpError(400, 'invalid_link');
  await app.repository.setEmailEnabled(userId, false, now(context));
  return { status: 200, body: { emailEnabled: false } satisfies EmailPreferencesResponse };
}
