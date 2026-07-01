/** Permission role derived from Cognito group membership. */
export type UserRole = 'ADMIN' | 'SUPER_ADMIN';

/** A user of the admin app, shaped for the frontend. */
export interface AdminUser {
  /** Email — the external identifier used by the API and attribution. */
  email: string;
  /** Cognito immutable subject id (used for the avatar S3 key). */
  sub: string | null;
  name: string | null;
  /** Job title / area label, stored in the Cognito `profile` attribute. */
  jobRole: string | null;
  /** Avatar S3 key, stored in the Cognito `picture` attribute. */
  avatarKey: string | null;
  /** Short-lived presigned GET URL for the avatar, if any. */
  avatarUrl: string | null;
  /** Highest permission role. */
  role: UserRole;
  groups: string[];
  enabled: boolean;
  /** Cognito UserStatus (CONFIRMED, FORCE_CHANGE_PASSWORD, ...). */
  status: string;
  createdAt: string | null;
}

/** Environment for the user-management routes. */
export interface UsersEnv {
  USER_POOL_ID: string;
  STOCK_BUCKET_NAME: string;
}

export interface InviteUserInput {
  email: string;
  name?: string | null;
  jobRole?: string | null;
}

export interface UpdateProfileInput {
  name?: string | null;
  jobRole?: string | null;
  avatarKey?: string | null;
}
