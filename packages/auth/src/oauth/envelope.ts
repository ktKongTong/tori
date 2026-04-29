export type OAuthErrorEnvelope<TError extends string = string> = {
  error: TError;
  error_description?: string;
  error_uri?: string;
};

export function oauthErrorEnvelope<TError extends string>(
  error: TError,
  description?: string,
): OAuthErrorEnvelope<TError> {
  const envelope: OAuthErrorEnvelope<TError> = { error };
  if (description !== undefined) envelope.error_description = description;
  return envelope;
}
