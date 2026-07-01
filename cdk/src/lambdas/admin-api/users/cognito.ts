import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminGetUserCommand,
  AdminListGroupsForUserCommand,
  AdminRemoveUserFromGroupCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
  type AttributeType,
} from '@aws-sdk/client-cognito-identity-provider';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { ADMIN_GROUP, SUPER_ADMIN_GROUP } from '../../../shared/admin-auth';
import type {
  AdminUser,
  InviteUserInput,
  UpdateProfileInput,
  UserRole,
  UsersEnv,
} from './types';

const AVATAR_URL_TTL_SECONDS = 3600;
const MANAGED_GROUPS = [ADMIN_GROUP, SUPER_ADMIN_GROUP];

let cognitoClient: CognitoIdentityProviderClient | undefined;
let s3Client: S3Client | undefined;

function getCognito(): CognitoIdentityProviderClient {
  if (!cognitoClient) {
    cognitoClient = new CognitoIdentityProviderClient({});
  }
  return cognitoClient;
}

function getS3(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({});
  }
  return s3Client;
}

/** Returns the avatar S3 key for a user's sub. */
export function avatarKeyForSub(sub: string): string {
  return `users/avatars/${sub}`;
}

function getAttr(attrs: AttributeType[] | undefined, name: string): string | null {
  const found = attrs?.find((attr) => attr.Name === name);
  return found?.Value ?? null;
}

function roleFromGroups(groups: string[]): UserRole {
  return groups.includes(SUPER_ADMIN_GROUP) ? 'SUPER_ADMIN' : 'ADMIN';
}

async function presignAvatar(env: UsersEnv, avatarKey: string | null): Promise<string | null> {
  if (!avatarKey) {
    return null;
  }
  return getSignedUrl(
    getS3(),
    new GetObjectCommand({ Bucket: env.STOCK_BUCKET_NAME, Key: avatarKey }),
    { expiresIn: AVATAR_URL_TTL_SECONDS },
  );
}

interface RawUser {
  attributes: AttributeType[] | undefined;
  enabled: boolean;
  status: string;
  createdAt: Date | undefined;
  groups: string[];
}

async function toUser(env: UsersEnv, raw: RawUser): Promise<AdminUser> {
  const avatarKey = getAttr(raw.attributes, 'picture');
  return {
    email: getAttr(raw.attributes, 'email') ?? '',
    sub: getAttr(raw.attributes, 'sub'),
    name: getAttr(raw.attributes, 'name'),
    jobRole: getAttr(raw.attributes, 'profile'),
    avatarKey,
    avatarUrl: await presignAvatar(env, avatarKey),
    role: roleFromGroups(raw.groups),
    groups: raw.groups,
    enabled: raw.enabled,
    status: raw.status,
    createdAt: raw.createdAt ? raw.createdAt.toISOString() : null,
  };
}

async function listGroups(env: UsersEnv, username: string): Promise<string[]> {
  const response = await getCognito().send(
    new AdminListGroupsForUserCommand({
      UserPoolId: env.USER_POOL_ID,
      Username: username,
    }),
  );
  return (response.Groups ?? [])
    .map((group) => group.GroupName)
    .filter((name): name is string => Boolean(name));
}

/** Lists all users in the pool with their groups and presigned avatars. */
export async function listUsers(env: UsersEnv): Promise<AdminUser[]> {
  const users: AdminUser[] = [];
  let paginationToken: string | undefined;

  do {
    const response = await getCognito().send(
      new ListUsersCommand({
        UserPoolId: env.USER_POOL_ID,
        PaginationToken: paginationToken,
        Limit: 60,
      }),
    );

    for (const user of response.Users ?? []) {
      const username = user.Username;
      const groups = username ? await listGroups(env, username) : [];
      users.push(
        await toUser(env, {
          attributes: user.Attributes,
          enabled: user.Enabled ?? true,
          status: user.UserStatus ?? 'UNKNOWN',
          createdAt: user.UserCreateDate,
          groups,
        }),
      );
    }

    paginationToken = response.PaginationToken;
  } while (paginationToken);

  users.sort((left, right) => left.email.localeCompare(right.email));
  return users;
}

/** Fetches a single user by email (Cognito email alias). Returns null if absent. */
export async function getUserByEmail(env: UsersEnv, email: string): Promise<AdminUser | null> {
  try {
    const response = await getCognito().send(
      new AdminGetUserCommand({ UserPoolId: env.USER_POOL_ID, Username: email }),
    );
    const username = response.Username ?? email;
    const groups = await listGroups(env, username);
    return toUser(env, {
      attributes: response.UserAttributes,
      enabled: response.Enabled ?? true,
      status: response.UserStatus ?? 'UNKNOWN',
      createdAt: response.UserCreateDate,
      groups,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'UserNotFoundException') {
      return null;
    }
    throw error;
  }
}

function buildAttributes(input: UpdateProfileInput): AttributeType[] {
  const attrs: AttributeType[] = [];
  if (input.name !== undefined) {
    attrs.push({ Name: 'name', Value: input.name ?? '' });
  }
  if (input.jobRole !== undefined) {
    attrs.push({ Name: 'profile', Value: input.jobRole ?? '' });
  }
  if (input.avatarKey !== undefined) {
    attrs.push({ Name: 'picture', Value: input.avatarKey ?? '' });
  }
  return attrs;
}

/** Updates a user's profile attributes (name/jobRole/avatarKey). */
export async function updateProfile(
  env: UsersEnv,
  email: string,
  input: UpdateProfileInput,
): Promise<AdminUser | null> {
  const attributes = buildAttributes(input);
  if (attributes.length > 0) {
    await getCognito().send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: env.USER_POOL_ID,
        Username: email,
        UserAttributes: attributes,
      }),
    );
  }
  return getUserByEmail(env, email);
}

/** Invites a new user (Cognito email invitation) and adds them to ADMIN. */
export async function inviteUser(env: UsersEnv, input: InviteUserInput): Promise<AdminUser | null> {
  const userAttributes: AttributeType[] = [
    { Name: 'email', Value: input.email },
    { Name: 'email_verified', Value: 'true' },
  ];
  if (input.name) {
    userAttributes.push({ Name: 'name', Value: input.name });
  }
  if (input.jobRole) {
    userAttributes.push({ Name: 'profile', Value: input.jobRole });
  }

  await getCognito().send(
    new AdminCreateUserCommand({
      UserPoolId: env.USER_POOL_ID,
      Username: input.email,
      UserAttributes: userAttributes,
      DesiredDeliveryMediums: ['EMAIL'],
    }),
  );

  await getCognito().send(
    new AdminAddUserToGroupCommand({
      UserPoolId: env.USER_POOL_ID,
      Username: input.email,
      GroupName: ADMIN_GROUP,
    }),
  );

  return getUserByEmail(env, input.email);
}

/** Sets a user's permission role by reconciling managed group membership. */
export async function setUserRole(
  env: UsersEnv,
  email: string,
  role: UserRole,
): Promise<AdminUser | null> {
  const desired = role === 'SUPER_ADMIN' ? [ADMIN_GROUP, SUPER_ADMIN_GROUP] : [ADMIN_GROUP];
  const current = await listGroups(env, email);

  for (const group of MANAGED_GROUPS) {
    const shouldHave = desired.includes(group);
    const has = current.includes(group);
    if (shouldHave && !has) {
      await getCognito().send(
        new AdminAddUserToGroupCommand({
          UserPoolId: env.USER_POOL_ID,
          Username: email,
          GroupName: group,
        }),
      );
    } else if (!shouldHave && has) {
      await getCognito().send(
        new AdminRemoveUserFromGroupCommand({
          UserPoolId: env.USER_POOL_ID,
          Username: email,
          GroupName: group,
        }),
      );
    }
  }

  return getUserByEmail(env, email);
}

export async function disableUser(env: UsersEnv, email: string): Promise<void> {
  await getCognito().send(
    new AdminDisableUserCommand({ UserPoolId: env.USER_POOL_ID, Username: email }),
  );
}

export async function enableUser(env: UsersEnv, email: string): Promise<void> {
  await getCognito().send(
    new AdminEnableUserCommand({ UserPoolId: env.USER_POOL_ID, Username: email }),
  );
}

export async function deleteUser(env: UsersEnv, email: string): Promise<void> {
  await getCognito().send(
    new AdminDeleteUserCommand({ UserPoolId: env.USER_POOL_ID, Username: email }),
  );
}

/** Creates a presigned PUT URL for the caller's avatar upload. */
export async function createAvatarUploadUrl(
  env: UsersEnv,
  sub: string,
  contentType: string,
): Promise<{ uploadUrl: string; key: string }> {
  const key = avatarKeyForSub(sub);
  const uploadUrl = await getSignedUrl(
    getS3(),
    new PutObjectCommand({
      Bucket: env.STOCK_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: 300 },
  );
  return { uploadUrl, key };
}
