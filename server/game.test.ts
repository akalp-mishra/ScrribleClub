import { once } from "node:events";
import { io as connect, type Socket } from "socket.io-client";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, type RoomState } from "../shared/protocol.js";
import { maskWord, normalizeGuess, validateSettings } from "./game/index.js";
import { startServer } from "./index.js";

function waitForEvent<T>(
  socket: Socket,
  event: string,
  predicate: (payload: T) => boolean = () => true,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, listener);
      reject(new Error(`Timed out waiting for ${event}.`));
    }, 5_000);
    const listener = (payload: T) => {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, listener);
      resolve(payload);
    };
    socket.on(event, listener);
  });
}

function connectClient(url: string): Promise<Socket> {
  const socket = connect(url, {
    transports: ["websocket"],
    reconnection: false,
  });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error("Timed out connecting to the game server."));
    }, 5_000);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once("connect_error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

describe("game", () => {
  let server: ReturnType<typeof startServer> | undefined;
  const clients: Socket[] = [];

  afterEach(async () => {
    for (const client of clients.splice(0)) client.disconnect();
    if (server) {
      const activeServer = server;
      server = undefined;
      await new Promise<void>((resolve) => activeServer.io.close(() => resolve()));
    }
  });

  it("normalizes exact guesses and masks unrevealed letters", () => {
    expect(normalizeGuess("  Ice   Cream ")).toBe("ice cream");
    expect(normalizeGuess("butter")).not.toBe(normalizeGuess("butterfly"));
    expect(maskWord("ice cream")).toBe("_ _ _   _ _ _ _ _");
    expect(maskWord("ice cream", new Set([0, 4]))).toBe("i _ _   c _ _ _ _");
  });

  it("clamps room settings to supported ranges", () => {
    const settings = validateSettings({
      visibility: "private",
      maxPlayers: 40,
      rounds: 1,
      drawTime: 300,
      wordCount: 0,
      hints: 8,
      wordMode: "hidden",
    });

    expect(settings).toEqual({
      ...DEFAULT_SETTINGS,
      visibility: "private",
      maxPlayers: 20,
      rounds: 2,
      drawTime: 240,
      wordCount: 1,
      hints: 5,
      wordMode: "hidden",
    });
    expect(() => validateSettings({ maxPlayers: "20" })).toThrow(/whole numbers/);
    expect(() => validateSettings({ wordMode: "secret" })).toThrow(/valid word mode/);
  });

  it("keeps the secret word private and syncs drawing and scoring", async () => {
    server = startServer(0);
    await once(server.httpServer, "listening");
    const address = server.httpServer.address();
    if (!address || typeof address === "string") {
      throw new Error("The test server did not start on a TCP port.");
    }
    const url = `http://127.0.0.1:${address.port}`;

    const host = await connectClient(url);
    clients.push(host);
    const guest = await connectClient(url);
    clients.push(guest);

    const hostJoined = waitForEvent<RoomState>(host, "room_joined");
    host.emit("create_room", {
      hostName: "Host",
      settings: { ...DEFAULT_SETTINGS, rounds: 2, drawTime: 15, hints: 0 },
    });
    const hostState = await hostJoined;

    const guestJoined = waitForEvent<RoomState>(guest, "room_joined");
    guest.emit("join_room", { roomId: hostState.roomId, playerName: "Guest" });
    await guestJoined;

    guest.emit("player_ready", { ready: true });
    const hostChoosing = waitForEvent<RoomState>(
      host,
      "game_state",
      (state) => state.phase === "choosing",
    );
    const guestChoosing = waitForEvent<RoomState>(
      guest,
      "game_state",
      (state) => state.phase === "choosing",
    );
    host.emit("start_game");

    const [drawerState, guesserState] = await Promise.all([hostChoosing, guestChoosing]);
    expect(drawerState.wordOptions).toHaveLength(DEFAULT_SETTINGS.wordCount);
    expect(guesserState.wordOptions).toBeUndefined();
    const word = drawerState.wordOptions?.[0];
    if (!word) throw new Error("The drawer did not receive any word choices.");

    const hostDrawing = waitForEvent<RoomState>(
      host,
      "game_state",
      (state) => state.phase === "drawing",
    );
    const guestDrawing = waitForEvent<RoomState>(
      guest,
      "game_state",
      (state) => state.phase === "drawing",
    );
    host.emit("word_chosen", { word });
    const [drawingState, drawingStateForGuest] = await Promise.all([hostDrawing, guestDrawing]);
    expect(drawingState.currentWord).toBe(word);
    expect(drawingStateForGuest.currentWord).toBeUndefined();

    const receivedStroke = waitForEvent<{ points: Array<{ x: number; y: number }> }>(
      guest,
      "draw_start",
    );
    host.emit("draw_start", {
      color: "#ff6b5e",
      size: 6,
      tool: "pen",
      point: { x: 0.2, y: 0.4 },
    });
    expect((await receivedStroke).points).toEqual([{ x: 0.2, y: 0.4 }]);
    const receivedPoint = waitForEvent<{ strokeId: string; point: { x: number; y: number } }>(
      guest,
      "draw_move",
    );
    host.emit("draw_move", { point: { x: 0.25, y: 0.45 } });
    expect((await receivedPoint).point).toEqual({ x: 0.25, y: 0.45 });

    const hostRoundEnd = waitForEvent<RoomState>(
      host,
      "game_state",
      (state) => state.phase === "round-end",
    );
    const guestRoundEnd = waitForEvent<RoomState>(
      guest,
      "game_state",
      (state) => state.phase === "round-end",
    );
    guest.emit("guess", { text: word.toUpperCase() });
    const [hostResult, guestResult] = await Promise.all([hostRoundEnd, guestRoundEnd]);
    expect(hostResult.currentWord).toBe(word);
    expect(guestResult.lastRound?.solvedBy).toBe(guest.id);
    const scoredGuest = guestResult.players.find((player) => player.id === guest.id);
    expect(scoredGuest?.score).toBeGreaterThan(0);
  }, 10_000);
});
