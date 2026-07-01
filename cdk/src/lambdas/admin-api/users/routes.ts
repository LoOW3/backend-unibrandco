import type { APIGatewayProxyResultV2 } from 'aws-lambda';

import { jsonResponse } from '../http-response';
import {
  getCallerIdentity,
  isAuthorizedSuperAdmin,
  type HttpApiEventWithJwt,
} from '../require-admin';
import type { AdminApiEnv } from '../types';
import {
  createAvatarUploadUrl,
  deleteUser,
  disableUser,
  enableUser,
  getUserByEmail,
  inviteUser,
  listUsers,
  setUserRole,
  updateProfile,
} from './cognito';
import type { UserRole, UsersEnv } from './types';

function parseBody<T>(body: string | undefined): T {
  if (!body) {
    return {} as T;
  }
  try {
    return JSON.parse(body) as T;
  } catch {
    return {} as T;
  }
}

function sameEmail(a: string | null, b: string | null): boolean {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}

/**
 * Handles /admin/users* routes. Returns null when the path is not a users
 * route so the main handler can continue. The base handler already enforced
 * ADMIN; SUPER_ADMIN-only routes are guarded here.
 */
export async function handleUsersRoutes(
  httpEvent: HttpApiEventWithJwt,
  adminEnv: AdminApiEnv,
  method: string,
  path: string,
): Promise<APIGatewayProxyResultV2 | null> {
  if (path !== '/admin/users' && !path.startsWith('/admin/users/')) {
    return null;
  }

  const env: UsersEnv = {
    USER_POOL_ID: adminEnv.USER_POOL_ID,
    STOCK_BUCKET_NAME: adminEnv.STOCK_BUCKET_NAME,
  };
  const caller = getCallerIdentity(httpEvent);

  // --- Self routes ---
  if (path === '/admin/users/me') {
    if (!caller.email) {
      return jsonResponse(401, { message: 'Unknown caller' });
    }
    if (method === 'GET') {
      const user = await getUserByEmail(env, caller.email);
      return user ? jsonResponse(200, user) : jsonResponse(404, { message: 'User not found' });
    }
    if (method === 'PATCH') {
      const body = parseBody<{ name?: string; jobRole?: string; avatarKey?: string }>(httpEvent.body);
      const user = await updateProfile(env, caller.email, body);
      return jsonResponse(200, user);
    }
  }

  if (path === '/admin/users/me/avatar-url' && method === 'POST') {
    if (!caller.sub) {
      return jsonResponse(401, { message: 'Unknown caller' });
    }
    const body = parseBody<{ contentType?: string }>(httpEvent.body);
    const result = await createAvatarUploadUrl(env, caller.sub, body.contentType ?? 'image/jpeg');
    return jsonResponse(200, result);
  }

  // --- Collection routes (ADMIN) ---
  if (path === '/admin/users' && method === 'GET') {
    return jsonResponse(200, { users: await listUsers(env) });
  }

  if (path === '/admin/users/invite' && method === 'POST') {
    const body = parseBody<{ email?: string; name?: string; jobRole?: string }>(httpEvent.body);
    if (!body.email) {
      return jsonResponse(400, { message: 'Missing email' });
    }
    const user = await inviteUser(env, {
      email: body.email,
      name: body.name,
      jobRole: body.jobRole,
    });
    return jsonResponse(201, user);
  }

  // --- Single-user routes (path param = email) ---
  const emailParam = httpEvent.pathParameters?.email;
  const email = emailParam ? decodeURIComponent(emailParam) : undefined;
  if (!email) {
    return jsonResponse(404, { message: 'Not found' });
  }

  if (method === 'GET') {
    const user = await getUserByEmail(env, email);
    return user ? jsonResponse(200, user) : jsonResponse(404, { message: 'User not found' });
  }

  // Everything below mutates another user → SUPER_ADMIN only.
  if (!isAuthorizedSuperAdmin(httpEvent)) {
    return jsonResponse(403, { message: 'Forbidden: SUPER_ADMIN required' });
  }

  if (method === 'PATCH') {
    const body = parseBody<{ name?: string; jobRole?: string; role?: UserRole }>(httpEvent.body);
    await updateProfile(env, email, { name: body.name, jobRole: body.jobRole });
    if (body.role) {
      if (sameEmail(email, caller.email)) {
        return jsonResponse(400, { message: 'Cannot change your own role' });
      }
      await setUserRole(env, email, body.role);
    }
    return jsonResponse(200, await getUserByEmail(env, email));
  }

  if (method === 'POST' && path.endsWith('/disable')) {
    if (sameEmail(email, caller.email)) {
      return jsonResponse(400, { message: 'Cannot disable yourself' });
    }
    await disableUser(env, email);
    return jsonResponse(200, await getUserByEmail(env, email));
  }

  if (method === 'POST' && path.endsWith('/enable')) {
    await enableUser(env, email);
    return jsonResponse(200, await getUserByEmail(env, email));
  }

  if (method === 'DELETE') {
    if (sameEmail(email, caller.email)) {
      return jsonResponse(400, { message: 'Cannot delete yourself' });
    }
    await deleteUser(env, email);
    return jsonResponse(200, { email, deleted: true });
  }

  return jsonResponse(404, { message: 'Not found' });
}
