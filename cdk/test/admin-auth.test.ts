import {
  isAdminUser,
  ADMIN_GROUP,
  parseCognitoGroups,
  getGroupsFromClaims,
} from '../src/lambdas/stock-sync/admin-auth';

describe('parseCognitoGroups', () => {
  it('parses array input', () => {
    expect(parseCognitoGroups(['ADMIN', 'USER'])).toEqual(['ADMIN', 'USER']);
  });

  it('parses single group string', () => {
    expect(parseCognitoGroups('ADMIN')).toEqual(['ADMIN']);
  });

  it('parses comma-separated groups', () => {
    expect(parseCognitoGroups('ADMIN,USER')).toEqual(['ADMIN', 'USER']);
  });

  it('parses JSON array string from API Gateway', () => {
    expect(parseCognitoGroups('["ADMIN"]')).toEqual(['ADMIN']);
  });

  it('parses bracket string without JSON quotes', () => {
    expect(parseCognitoGroups('[ADMIN]')).toEqual(['ADMIN']);
  });
});

describe('getGroupsFromClaims', () => {
  it('reads cognito:groups claim', () => {
    expect(getGroupsFromClaims({ 'cognito:groups': 'ADMIN' })).toEqual(['ADMIN']);
  });

  it('reads cognito_groups claim fallback', () => {
    expect(getGroupsFromClaims({ cognito_groups: 'ADMIN' })).toEqual(['ADMIN']);
  });
});

describe('isAdminUser', () => {
  it('returns true when ADMIN is in groups array', () => {
    expect(isAdminUser({ 'cognito:groups': [ADMIN_GROUP, 'OTHER'] })).toBe(true);
  });

  it('returns true when groups is a single ADMIN string', () => {
    expect(isAdminUser({ 'cognito:groups': ADMIN_GROUP })).toBe(true);
  });

  it('returns true when groups is API Gateway JSON string', () => {
    expect(isAdminUser({ 'cognito:groups': '["ADMIN"]' })).toBe(true);
  });

  it('returns false when ADMIN is not in groups', () => {
    expect(isAdminUser({ 'cognito:groups': ['USER'] })).toBe(false);
  });

  it('returns false when groups claim is missing', () => {
    expect(isAdminUser({ email: 'admin@example.com' })).toBe(false);
  });

  it('returns false when claims are undefined', () => {
    expect(isAdminUser(undefined)).toBe(false);
  });
});
