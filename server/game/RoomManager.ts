import { randomBytes } from "node:crypto";
import type { Server } from "socket.io";
import type { PublicRoom, RoomSettings } from "../../shared/protocol.js";
import { GameRoom } from "./GameRoom.js";
import { validateSettings } from "./validation.js";

export class RoomManager {
  private readonly io: Server;
  private readonly rooms = new Map<string, GameRoom>();

  constructor(io: Server) {
    this.io = io;
  }

  create(hostId: string, rawName: string, rawSettings: unknown): GameRoom {
    const settings: RoomSettings = validateSettings(rawSettings);
    const roomId = this.generateRoomId();
    const room = new GameRoom(this.io, roomId, hostId, settings);
    this.rooms.set(roomId, room);
    try {
      room.addPlayer(hostId, rawName);
    } catch (error) {
      this.rooms.delete(roomId);
      throw error;
    }
    this.broadcastPublicRooms();
    return room;
  }

  join(roomId: string, playerId: string, playerName: string): GameRoom {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) throw new Error("Room not found. Check the code and try again.");
    room.addPlayer(playerId, playerName);
    this.broadcastPublicRooms();
    return room;
  }

  leave(playerId: string): void {
    for (const [roomId, room] of this.rooms) {
      if (room.removePlayer(playerId)) {
        if (room.players.size === 0) {
          room.dispose();
          this.rooms.delete(roomId);
        }
        break;
      }
    }
    this.broadcastPublicRooms();
  }

  getRoom(roomId: string): GameRoom | undefined {
    return this.rooms.get(roomId.toUpperCase());
  }

  getPublicRooms(): PublicRoom[] {
    return [...this.rooms.values()]
      .filter(
        (room) =>
          room.settings.visibility === "public" &&
          room.phase === "lobby" &&
          room.players.size < room.settings.maxPlayers,
      )
      .map((room) => room.getPublicRoom())
      .sort((a, b) => a.roomId.localeCompare(b.roomId));
  }

  broadcastPublicRooms(): void {
    this.io.emit("public_rooms", this.getPublicRooms());
  }

  private generateRoomId(): string {
    let id = randomBytes(4).toString("hex").toUpperCase();
    while (this.rooms.has(id)) id = randomBytes(4).toString("hex").toUpperCase();
    return id;
  }
}
