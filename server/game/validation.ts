import {
  DEFAULT_SETTINGS,
  DRAWING_COLORS,
  type Point,
  type RoomSettings,
  type RoomVisibility,
  type WordMode,
} from "../../shared/protocol.js";

export function normalizeGuess(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function maskWord(word: string, revealed: Set<number> = new Set()): string {
  return Array.from(word)
    .map((character, index) => {
      if (!/[a-z0-9]/i.test(character) || revealed.has(index)) return character;
      return "_";
    })
    .join(" ");
}

export function validateSettings(input: unknown): RoomSettings {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Room settings are required.");
  }

  const value = input as Record<string, unknown>;
  return {
    visibility: enumSetting(value.visibility, DEFAULT_SETTINGS.visibility, ["public", "private"], "room type"),
    maxPlayers: boundedInteger(value.maxPlayers, DEFAULT_SETTINGS.maxPlayers, 2, 20),
    rounds: boundedInteger(value.rounds, DEFAULT_SETTINGS.rounds, 2, 10),
    drawTime: boundedInteger(value.drawTime, DEFAULT_SETTINGS.drawTime, 15, 240),
    wordCount: boundedInteger(value.wordCount, DEFAULT_SETTINGS.wordCount, 1, 5),
    hints: boundedInteger(value.hints, DEFAULT_SETTINGS.hints, 0, 5),
    wordMode: enumSetting(value.wordMode, DEFAULT_SETTINGS.wordMode, ["normal", "hidden"], "word mode"),
  };
}

function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error("Room settings must use whole numbers.");
  }
  return Math.min(max, Math.max(min, value));
}

function enumSetting<T extends RoomVisibility | WordMode>(
  value: unknown,
  fallback: T,
  choices: readonly T[],
  label: string,
): T {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !choices.some((choice) => choice === value)) {
    throw new Error(`Choose a valid ${label}.`);
  }
  return value as T;
}

export function sanitizeName(value: string): string {
  const name = value.trim().replace(/\s+/g, " ").slice(0, 20);
  if (!name) throw new Error("Please enter a player name.");
  return name;
}

export function validPoint(point: unknown): point is Point {
  if (!point || typeof point !== "object") return false;
  const { x, y } = point as Record<string, unknown>;
  return (
    typeof x === "number" &&
    typeof y === "number" &&
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    x >= 0 &&
    x <= 1 &&
    y >= 0 &&
    y <= 1
  );
}

export function isDrawingColor(value: unknown): value is (typeof DRAWING_COLORS)[number] {
  return typeof value === "string" && DRAWING_COLORS.some((color) => color === value);
}
