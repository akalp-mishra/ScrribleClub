import { randomUUID } from "node:crypto";
import type { Server } from "socket.io";
import {
  WORDS,
  type ChatMessage,
  type PublicPlayer,
  type PublicRoom,
  type RoomSettings,
  type RoomState,
  type RoundResult,
  type Stroke,
  type StrokeTool,
} from "../../shared/protocol.js";
import {
  isDrawingColor,
  maskWord,
  normalizeGuess,
  sanitizeName,
  validPoint,
  validateSettings,
} from "./validation.js";

export interface RoomPlayer {
  id: string;
  name: string;
  score: number;
  ready: boolean;
  joinedAt: number;
}

const WORD_PICK_SECONDS = 20;
const ROUND_REVEAL_SECONDS = 5;
const MAX_CHAT_LENGTH = 240;
const MAX_STROKES = 5_000;
const MAX_POINTS_PER_STROKE = 2_000;

export class GameRoom {
  readonly id: string;
  readonly settings: RoomSettings;
  readonly players = new Map<string, RoomPlayer>();
  hostId: string;
  phase: RoomState["phase"] = "lobby";
  round = 0;
  private totalTurns = 0;
  drawerId: string | null = null;
  wordOptions: string[] = [];
  currentWord: string | null = null;
  wordHint = "";
  timeLeft = 0;
  strokes: Stroke[] = [];
  messages: ChatMessage[] = [];
  lastRound: RoundResult | undefined;

  private readonly io: Server;
  private turnOrder: string[] = [];
  private turnIndex = -1;
  private deadline = 0;
  private clock: NodeJS.Timeout | undefined;
  private revealTimeouts: NodeJS.Timeout[] = [];
  private nextStrokeIdByPlayer = new Map<string, string>();
  private revealedLetters = new Set<number>();
  private disposed = false;

  constructor(io: Server, id: string, hostId: string, settings: RoomSettings) {
    this.io = io;
    this.id = id;
    this.hostId = hostId;
    this.settings = settings;
  }

  addPlayer(id: string, rawName: string): RoomPlayer {
    if (this.phase !== "lobby") throw new Error("This game has already started.");
    if (this.players.size >= this.settings.maxPlayers) throw new Error("This room is full.");
    if (this.players.has(id)) throw new Error("You are already in this room.");

    const name = sanitizeName(rawName);
    if ([...this.players.values()].some((player) => player.name.toLowerCase() === name.toLowerCase())) {
      throw new Error("That name is already in this room.");
    }

    const player: RoomPlayer = {
      id,
      name,
      score: 0,
      ready: id === this.hostId,
      joinedAt: Date.now(),
    };
    this.players.set(id, player);
    this.addMessage(null, "Scribble Club", `${name} joined the room.`, "system");
    this.broadcastState();
    return player;
  }

  removePlayer(id: string): boolean {
    const player = this.players.get(id);
    if (!player) return false;
    this.players.delete(id);
    this.nextStrokeIdByPlayer.delete(id);
    this.addMessage(null, "Scribble Club", `${player.name} left the room.`, "system");

    if (id === this.hostId) {
      const nextHost = [...this.players.values()].sort((a, b) => a.joinedAt - b.joinedAt)[0];
      if (nextHost) this.hostId = nextHost.id;
    }

    if (this.phase !== "lobby" && this.phase !== "game-over") {
      if (this.players.size < 2) {
        this.finishGame();
        return true;
      }
      if (id === this.drawerId) {
        if (this.phase === "drawing") {
          this.endRound(null, 0);
        } else if (this.phase === "choosing") {
          this.clearClock();
          this.advanceTurn();
        }
        return true;
      }
    }

    this.broadcastState();
    return true;
  }

  setReady(playerId: string, ready: boolean): void {
    this.requireLobby();
    const player = this.requirePlayer(playerId);
    player.ready = ready;
    this.broadcastState();
  }

  updateSettings(playerId: string, input: unknown): void {
    this.requireHost(playerId);
    this.requireLobby();
    const settings = validateSettings(input);
    if (settings.maxPlayers < this.players.size) {
      throw new Error("Maximum players cannot be lower than the current player count.");
    }
    Object.assign(this.settings, settings);
    this.broadcastState();
  }

  startGame(playerId: string): void {
    this.requireHost(playerId);
    this.requireLobby();
    if (this.players.size < 2) throw new Error("At least two players are needed to start.");
    if ([...this.players.values()].some((player) => !player.ready)) {
      throw new Error("Everyone needs to be ready before the game starts.");
    }

    this.turnOrder = [...this.players.values()]
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((player) => player.id);
    this.totalTurns = this.settings.rounds * this.turnOrder.length;
    this.turnIndex = -1;
    for (const player of this.players.values()) player.score = 0;
    this.phase = "choosing";
    this.addMessage(null, "Scribble Club", "The game is starting!", "system");
    this.advanceTurn();
  }

  chooseWord(playerId: string, word: string): void {
    if (this.phase !== "choosing" || playerId !== this.drawerId) {
      throw new Error("Only the current drawer can choose a word.");
    }
    const selected = this.wordOptions.find((option) => option === word);
    if (!selected) throw new Error("Choose one of the words shown.");
    this.clearClock();
    this.clearRevealTimeouts();
    this.currentWord = selected;
    this.revealedLetters.clear();
    this.wordHint = maskWord(selected);
    this.timeLeft = this.settings.drawTime;
    this.strokes = [];
    this.nextStrokeIdByPlayer.clear();
    this.phase = "drawing";
    this.addMessage(null, "Scribble Club", "The drawing round has started.", "system");
    this.broadcastState();
    this.startDrawingClock();
  }

  addGuess(playerId: string, rawText: string): void {
    if (this.phase !== "drawing" || playerId === this.drawerId) {
      throw new Error("Only guessers can submit guesses during a drawing round.");
    }
    const text = rawText.trim().slice(0, MAX_CHAT_LENGTH);
    if (!text) return;
    const player = this.requirePlayer(playerId);
    if (normalizeGuess(text) === normalizeGuess(this.currentWord ?? "")) {
      const points = 100 + Math.floor((this.timeLeft / this.settings.drawTime) * 400);
      player.score += points;
      const drawer = this.drawerId ? this.players.get(this.drawerId) : undefined;
      if (drawer) drawer.score += 50;
      this.io.to(this.id).emit("guess_result", {
        playerId,
        playerName: player.name,
        points,
      });
      this.addMessage(playerId, player.name, `${player.name} guessed the word!`, "correct");
      this.endRound(playerId, points);
      return;
    }

    this.addMessage(playerId, player.name, text, "guess");
  }

  addChat(playerId: string, rawText: string): void {
    const player = this.requirePlayer(playerId);
    const text = rawText.trim().slice(0, MAX_CHAT_LENGTH);
    if (!text) return;
    this.addMessage(playerId, player.name, text, "chat");
  }

  startStroke(
    playerId: string,
    input: { color?: unknown; size?: unknown; tool?: unknown; point?: unknown },
  ): void {
    this.requireDrawer(playerId);
    if (this.strokes.length >= MAX_STROKES) throw new Error("This round has reached the stroke limit.");
    if (!validPoint(input.point)) throw new Error("Invalid drawing coordinates.");
    const color = isDrawingColor(input.color) ? input.color : "#1b1b1b";
    const size =
      typeof input.size === "number" && Number.isFinite(input.size)
        ? Math.min(28, Math.max(2, input.size))
        : 5;
    const tool: StrokeTool = input.tool === "eraser" ? "eraser" : "pen";
    const stroke: Stroke = {
      id: randomUUID(),
      playerId,
      color,
      size,
      tool,
      points: [input.point],
    };
    this.strokes.push(stroke);
    this.nextStrokeIdByPlayer.set(playerId, stroke.id);
    this.io.to(this.id).emit("draw_start", stroke);
  }

  moveStroke(playerId: string, point: unknown): void {
    this.requireDrawer(playerId);
    if (!validPoint(point)) throw new Error("Invalid drawing coordinates.");
    const strokeId = this.nextStrokeIdByPlayer.get(playerId);
    const stroke = this.strokes.find((item) => item.id === strokeId);
    if (!stroke) throw new Error("Start a stroke before sending drawing points.");
    if (stroke.points.length >= MAX_POINTS_PER_STROKE) {
      throw new Error("This stroke has reached the point limit.");
    }
    stroke.points.push(point);
    this.io.to(this.id).emit("draw_move", { strokeId, point });
  }

  endStroke(playerId: string): void {
    if (this.phase !== "drawing" || playerId !== this.drawerId) return;
    this.nextStrokeIdByPlayer.delete(playerId);
    this.io.to(this.id).emit("draw_end", { playerId });
  }

  undoStroke(playerId: string): void {
    this.requireDrawer(playerId);
    const index = this.strokes.map((stroke) => stroke.playerId).lastIndexOf(playerId);
    if (index >= 0) this.strokes.splice(index, 1);
    this.nextStrokeIdByPlayer.delete(playerId);
    this.broadcastCanvas();
  }

  clearCanvas(playerId: string): void {
    this.requireDrawer(playerId);
    this.strokes = [];
    this.nextStrokeIdByPlayer.clear();
    this.broadcastCanvas();
  }

  getPublicRoom(): PublicRoom {
    const host = this.players.get(this.hostId);
    return {
      roomId: this.id,
      hostName: host?.name ?? "Host",
      playerCount: this.players.size,
      settings: { ...this.settings },
    };
  }

  getClientState(playerId: string): RoomState {
    const players: PublicPlayer[] = [...this.players.values()]
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((player) => ({
        id: player.id,
        name: player.name,
        score: player.score,
        ready: player.ready,
      }));
    const visibleMessages = this.messages.filter(
      (message) =>
        !(
          this.phase === "drawing" &&
          playerId === this.drawerId &&
          (message.kind === "guess" || message.kind === "correct")
        ),
    );
    const state: RoomState = {
      roomId: this.id,
      settings: { ...this.settings },
      players,
      hostId: this.hostId,
      phase: this.phase,
      round: this.round,
      drawerId: this.drawerId,
      wordHint: this.wordHint,
      timeLeft: this.timeLeft,
      strokes: this.strokes.map((stroke) => ({
        ...stroke,
        points: [...stroke.points],
      })),
      messages: visibleMessages,
      ...(this.lastRound ? { lastRound: this.lastRound } : {}),
    };

    if (this.phase === "choosing" && playerId === this.drawerId) {
      state.wordOptions = [...this.wordOptions];
    }
    if (this.phase === "drawing" && playerId === this.drawerId && this.settings.wordMode === "normal") {
      state.currentWord = this.currentWord ?? undefined;
    }
    if ((this.phase === "round-end" || this.phase === "game-over") && this.currentWord) {
      state.currentWord = this.currentWord;
    }
    return state;
  }

  dispose(): void {
    this.disposed = true;
    this.clearClock();
    this.clearRevealTimeouts();
  }

  private advanceTurn(): void {
    if (this.disposed || this.players.size < 2) {
      this.finishGame();
      return;
    }

    let nextId: string | undefined;
    while (this.turnIndex + 1 < this.totalTurns && !nextId) {
      this.turnIndex += 1;
      const candidate = this.turnOrder[this.turnIndex % this.turnOrder.length];
      if (this.players.has(candidate)) nextId = candidate;
    }
    if (!nextId) {
      this.finishGame();
      return;
    }

    this.drawerId = nextId;
    this.round = Math.floor(this.turnIndex / this.turnOrder.length) + 1;
    this.phase = "choosing";
    this.currentWord = null;
    this.wordHint = "";
    this.lastRound = undefined;
    this.strokes = [];
    this.nextStrokeIdByPlayer.clear();
    this.wordOptions = this.pickWords();
    this.timeLeft = WORD_PICK_SECONDS;
    this.addMessage(null, "Scribble Club", `${this.players.get(nextId)?.name} is choosing a word.`, "system");
    this.broadcastState();
    this.startClock(WORD_PICK_SECONDS, () => {
      const fallbackWord = this.wordOptions[0];
      if (fallbackWord && this.drawerId) this.chooseWord(this.drawerId, fallbackWord);
    });
  }

  private pickWords(): string[] {
    const shuffled = [...WORDS];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled.slice(0, Math.min(this.settings.wordCount, WORDS.length));
  }

  private startDrawingClock(): void {
    const count = this.settings.hints;
    if (count > 0) {
      const interval = (this.settings.drawTime * 1000) / (count + 1);
      for (let hint = 1; hint <= count; hint += 1) {
        const timeout = setTimeout(() => this.revealHint(), interval * hint);
        this.revealTimeouts.push(timeout);
      }
    }
    this.startClock(this.settings.drawTime, () => this.endRound(null, 0));
  }

  private revealHint(): void {
    if (this.phase !== "drawing" || !this.currentWord) return;
    const hiddenIndices = Array.from(this.currentWord)
      .map((character, index) => ({ character, index }))
      .filter(({ character, index }) => /[a-z0-9]/i.test(character) && !this.revealedLetters.has(index))
      .map(({ index }) => index);
    if (!hiddenIndices.length) return;
    const next = hiddenIndices[Math.floor(Math.random() * hiddenIndices.length)];
    this.revealedLetters.add(next);
    this.wordHint = maskWord(this.currentWord, this.revealedLetters);
    this.broadcastState();
  }

  private endRound(solvedBy: string | null, pointsAwarded: number): void {
    if (this.phase !== "drawing") return;
    this.clearClock();
    this.clearRevealTimeouts();
    this.phase = "round-end";
    this.timeLeft = 0;
    this.lastRound = {
      word: this.currentWord ?? "",
      solvedBy,
      pointsAwarded,
    };
    this.broadcastState();
    this.clock = setTimeout(() => this.advanceTurn(), ROUND_REVEAL_SECONDS * 1000);
  }

  private finishGame(): void {
    this.clearClock();
    this.clearRevealTimeouts();
    if (this.phase === "game-over") return;
    this.phase = "game-over";
    this.timeLeft = 0;
    this.drawerId = null;
    this.wordOptions = [];
    this.addMessage(null, "Scribble Club", "Game over! Check out the final scores.", "system");
    this.broadcastState();
  }

  private startClock(seconds: number, onComplete: () => void): void {
    this.clearClock();
    this.deadline = Date.now() + seconds * 1000;
    this.timeLeft = seconds;
    this.clock = setInterval(() => {
      this.timeLeft = Math.max(0, Math.ceil((this.deadline - Date.now()) / 1000));
      if (this.timeLeft <= 0) {
        this.clearClock();
        onComplete();
        return;
      }
      this.broadcastState();
    }, 1000);
  }

  private clearClock(): void {
    if (this.clock) clearTimeout(this.clock);
    this.clock = undefined;
  }

  private clearRevealTimeouts(): void {
    for (const timeout of this.revealTimeouts) clearTimeout(timeout);
    this.revealTimeouts = [];
  }

  private addMessage(
    playerId: string | null,
    playerName: string,
    text: string,
    kind: ChatMessage["kind"],
  ): void {
    this.messages.push({
      id: randomUUID(),
      playerId,
      playerName,
      text,
      kind,
      createdAt: Date.now(),
    });
    if (this.messages.length > 100) this.messages.shift();
    const message = this.messages[this.messages.length - 1];
    for (const player of this.players.values()) {
      if (
        this.phase === "drawing" &&
        player.id === this.drawerId &&
        (kind === "guess" || kind === "correct")
      ) {
        continue;
      }
      this.io.to(player.id).emit("chat_message", message);
    }
  }

  private broadcastState(): void {
    for (const player of this.players.values()) {
      this.io.to(player.id).emit("game_state", this.getClientState(player.id));
    }
  }

  private broadcastCanvas(): void {
    this.io.to(this.id).emit("canvas_state", this.strokes);
  }

  private requirePlayer(id: string): RoomPlayer {
    const player = this.players.get(id);
    if (!player) throw new Error("You are not in this room.");
    return player;
  }

  private requireHost(id: string): void {
    this.requirePlayer(id);
    if (id !== this.hostId) throw new Error("Only the host can do that.");
  }

  private requireDrawer(id: string): void {
    if (this.phase !== "drawing" || id !== this.drawerId) {
      throw new Error("Only the drawer can change the canvas.");
    }
  }

  private requireLobby(): void {
    if (this.phase !== "lobby") throw new Error("These settings can only be changed in the lobby.");
  }
}
