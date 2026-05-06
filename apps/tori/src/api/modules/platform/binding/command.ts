import { NotFoundError, ParameterError, UnauthorizedError } from "@/api/domain/error/index.ts";
import type { ServiceContext } from "@/api/domain/infra/service-context.ts";
import { randomCode } from "@repo/utils/random";
import { sha256Hash } from "@repo/utils/encoding/hash";
import { uniqueId } from "@repo/utils/id";

import { getBindingRepository } from "./repository/index.js";
import type {
  BindingGrantPurpose,
  BindingGrantSubjectType,
  ConsumeAnonymousClaimInput,
  ConsumeBindingGrantInput,
  IssueBindingTokenInput,
} from "./type.js";

const bindingGrantIssueRules: Record<
  BindingGrantPurpose,
  {
    subjectType: BindingGrantSubjectType;
    issuedToSurface: IssueBindingTokenInput["issuedToSurface"];
  }
> = {
  "claim-user": {
    subjectType: "user",
    issuedToSurface: "web",
  },
  "bind-user": {
    subjectType: "user",
    issuedToSurface: "bot",
  },
  "bind-channel": {
    subjectType: "channel",
    issuedToSurface: "bot",
  },
};

type BindingGrantValidationTarget = {
  purpose: string;
  subjectType: string;
  issuedToSurface: string;
};

function createBindingCodeValue() {
  return randomCode(4).toUpperCase();
}

function createPlaintextToken() {
  return randomCode("gbt", 24);
}

async function hashToken(token: string) {
  return sha256Hash(token);
}

export function assertBindingGrantIssueInput(input: IssueBindingTokenInput) {
  const expected = bindingGrantIssueRules[input.purpose];

  if (input.subjectType !== expected.subjectType) {
    throw new ParameterError(
      `Token purpose ${input.purpose} must use subject type ${expected.subjectType}`,
    );
  }

  if (input.issuedToSurface !== expected.issuedToSurface) {
    throw new ParameterError(
      `Token purpose ${input.purpose} can only be issued for ${expected.issuedToSurface}`,
    );
  }
}

export function assertBindingGrantCanBeConsumed(
  grant: BindingGrantValidationTarget,
  input: ConsumeBindingGrantInput,
) {
  const expected = bindingGrantIssueRules[grant.purpose as BindingGrantPurpose];
  if (!expected) {
    throw new ParameterError(`Unsupported binding token purpose: ${grant.purpose}`);
  }

  if (
    grant.subjectType !== expected.subjectType ||
    grant.issuedToSurface !== expected.issuedToSurface
  ) {
    throw new ParameterError("Binding token configuration is invalid");
  }

  if (input.consumeSurface !== expected.issuedToSurface) {
    throw new ParameterError(
      input.consumeSurface === "bot"
        ? "This token can only be used on web."
        : "This token can only be used in bot.",
    );
  }

  if (
    input.allowedSubjectTypes &&
    !input.allowedSubjectTypes.includes(grant.subjectType as BindingGrantSubjectType)
  ) {
    if (input.allowedSubjectTypes.length === 1 && input.allowedSubjectTypes[0] === "user") {
      throw new ParameterError("Bot currently only supports user binding tokens.");
    }
    throw new ParameterError(`Unsupported token subject type: ${grant.subjectType}`);
  }
}

export async function issueBindingToken(ctx: ServiceContext, input: IssueBindingTokenInput) {
  assertBindingGrantIssueInput(input);

  const codeExpiresAt = input.codeExpiresAt
    ? new Date(input.codeExpiresAt)
    : new Date(Date.now() + 10 * 60_000);
  const tokenExpiresAt = input.tokenExpiresAt
    ? new Date(input.tokenExpiresAt)
    : new Date(Date.now() + 10 * 60_000);
  const plaintextToken = createPlaintextToken();

  const grant = await getBindingRepository(ctx).createBindingGrant({
    id: uniqueId(),
    code: createBindingCodeValue(),
    tokenHash: await hashToken(plaintextToken),
    purpose: input.purpose,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    issuedByUserId: ctx.userId ?? null,
    issuedFrom: "backend",
    issuedToSurface: input.issuedToSurface,
    codeExpiresAt,
    tokenExpiresAt,
    maxUses: input.maxUses ?? 1,
    metadata: input.metadata ?? null,
  });

  return { grant, plaintextToken };
}

export async function consumeAnonymousClaim(
  ctx: ServiceContext,
  input: ConsumeAnonymousClaimInput,
) {
  const repository = getBindingRepository(ctx);
  const tokenHash = await hashToken(input.token);
  const grant = await repository.findPendingBindingGrantByTokenHash(tokenHash);
  if (!grant) throw new ParameterError("Claim token is invalid or already consumed");

  assertBindingGrantCanBeConsumed(grant, {
    consumeSurface: "web",
  });

  const claimSession = await repository.findClaimSessionByGrantId(grant.id);
  if (!claimSession?.anonymousUserId) throw new NotFoundError("Claim session not found");

  const anonymousUser = await repository.findUserById(claimSession.anonymousUserId);
  if (!anonymousUser) throw new NotFoundError("Anonymous user not found");

  const authenticatedUserId = ctx.userId;
  if (!authenticatedUserId) throw new NotFoundError("Authenticated user not found");
  const resolution = authenticatedUserId === anonymousUser.id ? "claimed" : "merged";

  const resolved = await repository.resolveAnonymousClaim({
    grantId: grant.id,
    claimSessionId: claimSession.id,
    anonymousUserId: anonymousUser.id,
    authenticatedUserId,
    resolution,
  });

  return {
    claimSession: resolved,
    anonymousUser,
    authenticatedUserId,
    resolution,
  };
}

export async function revokeUserBinding(ctx: ServiceContext, bindingId: string) {
  const repository = getBindingRepository(ctx);
  const binding = await repository.findUserBindingById(bindingId);

  if (!binding) throw new NotFoundError("User binding not found");
  if (binding.status !== "active") throw new ParameterError("User binding is already inactive");

  if (!ctx.userId) throw new UnauthorizedError("Authenticated user required");
  if (!ctx.isAdmin() && binding.userId !== ctx.userId) {
    throw new UnauthorizedError("You can only remove your own user binding");
  }

  const revoked = await repository.revokeUserBinding(binding.id);

  return revoked;
}
