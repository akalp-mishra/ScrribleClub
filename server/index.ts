import express from "express";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Server } from "socket.io";
import { GameRoom, RoomManager } from "./game/index.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function startServer(port = Number(process.env.PORT) || 3001) {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    maxHttpBufferSize: 1e6,
  });
  const rooms = new RoomManager(io);
  const playerRooms = new Map<string, string>();

  app.get("/api/health", (_request, response) => {
    response.json({ status: "ok" });
  });
  app.get("/api/rooms", (_request, response) => {
    response.json(rooms.getPublicRooms());
  });

  const clientDirectory = path.resolve(currentDirectory, "../../dist/client");
  const clientIndex = path.join(clientDirectory, "index.html");
  if (existsSync(clientIndex)) {
    app.use(express.static(clientDirectory));
    app.get(/^(?!\/api|\/socket\.io).*/, (_request, response, next) => {
      response.sendFile(clientIndex, (error) => {
        if (error) next(error);
      });
    });
  }

  io.on("connection", (socket) => {
    const reportError = (error: unknown) => {
      const message = error instanceof Error ? error.message : "Something went wrong.";
      socket.emit("server_error", message);
    };
    const requireRoom = () => {
      const roomId = playerRooms.get(socket.id);
      const room = roomId ? rooms.getRoom(roomId) : undefined;
      if (!room) throw new Error("Join a room first.");
      return room;
    };
    const inRoom = (action: (room: GameRoom) => void) => {
      try {
        action(requireRoom());
      } catch (error) {
        reportError(error);
      }
    };
    const leaveRoom = () => {
      const roomId = playerRooms.get(socket.id);
      if (!roomId) return;
      rooms.leave(socket.id);
      playerRooms.delete(socket.id);
      socket.leave(roomId);
      socket.emit("left_room");
    };

    socket.emit("public_rooms", rooms.getPublicRooms());
    socket.on("list_public_rooms", () => {
      socket.emit("public_rooms", rooms.getPublicRooms());
    });

    socket.on("create_room", (payload: unknown) => {
      try {
        if (playerRooms.has(socket.id)) throw new Error("Leave your current room first.");
        if (!isRecord(payload)) throw new Error("Invalid room details.");
        const room = rooms.create(socket.id, text(payload.hostName), payload.settings);
        socket.join(room.id);
        playerRooms.set(socket.id, room.id);
        socket.emit("room_joined", room.getClientState(socket.id));
        rooms.broadcastPublicRooms();
      } catch (error) {
        reportError(error);
      }
    });

    socket.on("join_room", (payload: unknown) => {
      try {
        if (playerRooms.has(socket.id)) throw new Error("Leave your current room first.");
        if (!isRecord(payload)) throw new Error("Invalid room details.");
        const room = rooms.join(text(payload.roomId), socket.id, text(payload.playerName));
        socket.join(room.id);
        playerRooms.set(socket.id, room.id);
        socket.emit("room_joined", room.getClientState(socket.id));
        rooms.broadcastPublicRooms();
      } catch (error) {
        reportError(error);
      }
    });

    socket.on("leave_room", leaveRoom);
    socket.on("player_ready", (payload: unknown) =>
      inRoom((room) => {
        if (!isRecord(payload) || typeof payload.ready !== "boolean") {
          throw new Error("Invalid ready status.");
        }
        room.setReady(socket.id, payload.ready);
      }),
    );
    socket.on("update_settings", (payload: unknown) =>
      inRoom((room) => {
        if (!isRecord(payload)) throw new Error("Invalid room settings.");
        room.updateSettings(socket.id, payload.settings);
        rooms.broadcastPublicRooms();
      }),
    );
    socket.on("start_game", () => inRoom((room) => room.startGame(socket.id)));
    socket.on("word_chosen", (payload: unknown) =>
      inRoom((room) => {
        if (!isRecord(payload)) throw new Error("Choose one of the available words.");
        room.chooseWord(socket.id, text(payload.word));
      }),
    );
    socket.on("guess", (payload: unknown) =>
      inRoom((room) => {
        if (!isRecord(payload)) throw new Error("Enter a guess.");
        room.addGuess(socket.id, text(payload.text));
      }),
    );
    socket.on("chat", (payload: unknown) =>
      inRoom((room) => {
        if (!isRecord(payload)) throw new Error("Enter a message.");
        room.addChat(socket.id, text(payload.text));
      }),
    );
    socket.on("draw_start", (payload: unknown) =>
      inRoom((room) => {
        if (!isRecord(payload)) throw new Error("Invalid drawing action.");
        room.startStroke(socket.id, payload);
      }),
    );
    socket.on("draw_move", (payload: unknown) =>
      inRoom((room) => {
        if (!isRecord(payload)) throw new Error("Invalid drawing action.");
        room.moveStroke(socket.id, payload.point);
      }),
    );
    socket.on("draw_end", () => inRoom((room) => room.endStroke(socket.id)));
    socket.on("draw_undo", () => inRoom((room) => room.undoStroke(socket.id)));
    socket.on("canvas_clear", () => inRoom((room) => room.clearCanvas(socket.id)));

    socket.on("disconnect", () => {
      rooms.leave(socket.id);
      playerRooms.delete(socket.id);
    });
  });

  httpServer.listen(port);
  return { app, httpServer, io, rooms };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const { httpServer } = startServer();
  httpServer.on("listening", () => {
    const address = httpServer.address();
    const port = typeof address === "object" && address ? address.port : process.env.PORT ?? 3001;
    console.log(`Scribble Club server listening on port ${port}`);
  });
}
