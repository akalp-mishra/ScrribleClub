export type RoomVisibility = "public" | "private";
export type WordMode = "normal" | "hidden";
export type GamePhase =
  | "lobby"
  | "choosing"
  | "drawing"
  | "round-end"
  | "game-over";
export type StrokeTool = "pen" | "eraser";

export interface RoomSettings {
  visibility: RoomVisibility;
  maxPlayers: number;
  rounds: number;
  drawTime: number;
  wordCount: number;
  hints: number;
  wordMode: WordMode;
}

export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  id: string;
  playerId: string;
  color: string;
  size: number;
  tool: StrokeTool;
  points: Point[];
}

export interface PublicPlayer {
  id: string;
  name: string;
  score: number;
  ready: boolean;
}

export interface ChatMessage {
  id: string;
  playerId: string | null;
  playerName: string;
  text: string;
  kind: "chat" | "guess" | "correct" | "system";
  createdAt: number;
}

export interface PublicRoom {
  roomId: string;
  hostName: string;
  playerCount: number;
  settings: RoomSettings;
}

export interface RoundResult {
  word: string;
  solvedBy: string | null;
  pointsAwarded: number;
}

export interface RoomState {
  roomId: string;
  settings: RoomSettings;
  players: PublicPlayer[];
  hostId: string;
  phase: GamePhase;
  round: number;
  drawerId: string | null;
  wordOptions?: string[];
  currentWord?: string;
  wordHint: string;
  timeLeft: number;
  strokes: Stroke[];
  messages: ChatMessage[];
  lastRound?: RoundResult;
}

export const DEFAULT_SETTINGS: RoomSettings = {
  visibility: "public",
  maxPlayers: 8,
  rounds: 3,
  drawTime: 80,
  wordCount: 3,
  hints: 2,
  wordMode: "normal",
};

export const DRAWING_COLORS = [
  "#1b1b1b",
  "#ffffff",
  "#ff6b5e",
  "#ffb84d",
  "#f4d94e",
  "#79c96b",
  "#48b6a8",
  "#54a8e8",
  "#7564d8",
  "#e36ab3",
  "#986348",
  "#a4a4a4",
] as const;
