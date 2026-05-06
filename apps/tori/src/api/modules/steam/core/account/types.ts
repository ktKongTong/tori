export interface FetchSteamPublicProfileInput {
  connectionId: string;
  ownerUserId?: string;
}

export interface QuerySteamUserLibraryInput {
  connectionId: string;
  ownerUserId?: string;
  query?: string | null;
  limit?: number;
}

export type SteamOwnedGamesResponse = {
  response?: {
    game_count?: number;
    games?: Array<{
      appid: number;
      name?: string;
      playtime_forever?: number;
      rtime_last_played?: number;
      img_icon_url?: string;
      img_logo_url?: string;
    }>;
  };
};
