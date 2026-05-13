import type { FetchLike, ToriBotCommandResponse, ToriCommandRequest } from "./types.js";

export class ToriIngressError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
    this.name = "ToriIngressError";
  }
}

export async function sendToriCommandRequest(input: {
  fetchImpl: FetchLike;
  baseUrl: string;
  credential: string;
  request: ToriCommandRequest;
}): Promise<ToriBotCommandResponse> {
  const response = await input.fetchImpl(`${input.baseUrl}/api/bot-ingress/request`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-bot-plugin-credential": input.credential,
    },
    body: JSON.stringify(input.request),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new ToriIngressError(
      `Tori bot-ingress request failed with ${response.status}`,
      response.status,
      body,
    );
  }

  return (await response.json()) as ToriBotCommandResponse;
}
