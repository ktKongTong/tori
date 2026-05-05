export type AuthSessionRequest = {
  headers: Headers;
};

export type AuthSessionApi<TSession> = {
  api: {
    getSession(input: AuthSessionRequest): Promise<TSession | null>;
  };
};

export type AuthSessionResolver<TSession> = (
  request: AuthSessionRequest,
) => Promise<TSession | null>;

export function createAuthSessionResolver<TSession>(
  auth: AuthSessionApi<TSession>,
): AuthSessionResolver<TSession> {
  return (request) => auth.api.getSession(request);
}

export async function resolveAuthSession<TSession>(
  resolver: AuthSessionResolver<TSession>,
  request: AuthSessionRequest,
): Promise<TSession | null> {
  return resolver(request);
}
