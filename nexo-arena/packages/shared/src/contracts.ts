import type { GameState, Mark } from "@nexo/engine";

// No backend is configured in this release. These contracts describe future adapters.
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}
export interface AuthTokenStore {
  read(): Promise<AuthTokens | null>;
  write(tokens: AuthTokens): Promise<void>;
  clear(): Promise<void>;
}
export interface OnlineSnapshot {
  matchId: string;
  revision: number;
  rulesVersion: "classic-v1";
  game: GameState;
  players: Record<Mark, string>;
  phase:
    | "waiting"
    | "active"
    | "reconnecting"
    | "completed"
    | "forfeited"
    | "abandoned";
}
export interface MoveCommand {
  matchId: string;
  expectedRevision: number;
  requestId: string;
  square: number;
}
export interface OnlineMatchTransport {
  joinInvite(token: string): Promise<OnlineSnapshot>;
  fetchMatch(id: string): Promise<OnlineSnapshot>;
  submitMove(command: MoveCommand): Promise<OnlineSnapshot>;
  subscribe(
    id: string,
    receive: (snapshot: OnlineSnapshot) => void,
  ): () => void;
}
export function validInviteToken(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{8,128}$/.test(token);
}
