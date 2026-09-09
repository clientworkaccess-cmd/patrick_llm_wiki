export const AUTH_CREDENTIALS = {
  email: 'knowledge@graph.com',
  password: 'graph2468',
} as const;

export const AUTH_COOKIE_NAME = 'kg_session';
export const AUTH_TOKEN_VALUE = 'kg_authenticated_session_token_v1';

export function isValidCredentials(email?: string | null, password?: string | null): boolean {
  if (!email || !password) return false;
  return (
    email.trim().toLowerCase() === AUTH_CREDENTIALS.email.toLowerCase() &&
    password === AUTH_CREDENTIALS.password
  );
}

export function isAuthenticatedToken(token?: string | null): boolean {
  return token === AUTH_TOKEN_VALUE;
}