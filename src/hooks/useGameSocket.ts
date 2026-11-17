import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import {
  type ChatMessage,
  type Point,
  type PublicRoom,
  type RoomSettings,
  type RoomState,
  type Stroke,
  type StrokeTool,
} from "../../shared/protocol.js";

const socket = io({ autoConnect: true });

export interface GameActions {
  createRoom: (hostName: string, settings: RoomSettings) => void;
  joinRoom: (roomId: string, playerName: string) => void;
  leaveRoom: () => void;
  setReady: (ready: boolean) => void;
  updateSettings: (settings: RoomSettings) => void;
  startGame: () => void;
  chooseWord: (word: string) => void;
  sendDrawStart: (point: Point, color: string, size: number, tool: StrokeTool) => void;
  sendDrawMove: (point: Point) => void;
  endStroke: () => void;
  undoStroke: () => void;
  clearCanvas: () => void;
  submitMessage: (text: string, isGuess: boolean) => void;
}

export function useGameSocket() {
  const [connected, setConnected] = useState(socket.connected);
  const [playerId, setPlayerId] = useState(socket.id ?? "");
  const [room, setRoom] = useState<RoomState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const onConnect = () => {
      setConnected(true);
      setPlayerId(socket.id ?? "");
      socket.emit("list_public_rooms");
    };
    const onDisconnect = () => setConnected(false);
    const onState = (next: RoomState) => {
      setRoom(next);
      setMessages(next.messages);
    };
    const onMessage = (message: ChatMessage) =>
      setMessages((current) => [...current.filter((item) => item.id !== message.id), message]);
    const onDrawStart = (stroke: Stroke) =>
      setRoom((current) => {
        if (!current || current.strokes.some((item) => item.id === stroke.id)) return current;
        return { ...current, strokes: [...current.strokes, stroke] };
      });
    const onDrawMove = ({ strokeId, point }: { strokeId: string; point: Point }) =>
      setRoom((current) => {
        if (!current) return current;
        return {
          ...current,
          strokes: current.strokes.map((stroke) =>
            stroke.id === strokeId ? { ...stroke, points: [...stroke.points, point] } : stroke,
          ),
        };
      });
    const onCanvasState = (strokes: Stroke[]) =>
      setRoom((current) => (current ? { ...current, strokes } : current));
    const onPublicRooms = (rooms: PublicRoom[]) => setPublicRooms(rooms);
    const onError = (message: string) => {
      setError(message);
      window.setTimeout(() => setError(""), 4_000);
    };
    const onLeftRoom = () => {
      setRoom(null);
      setMessages([]);
      window.history.replaceState(null, "", "/");
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("game_state", onState);
    socket.on("room_joined", onState);
    socket.on("chat_message", onMessage);
    socket.on("draw_start", onDrawStart);
    socket.on("draw_move", onDrawMove);
    socket.on("canvas_state", onCanvasState);
    socket.on("public_rooms", onPublicRooms);
    socket.on("server_error", onError);
    socket.on("left_room", onLeftRoom);
    socket.emit("list_public_rooms");

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("game_state", onState);
      socket.off("room_joined", onState);
      socket.off("chat_message", onMessage);
      socket.off("draw_start", onDrawStart);
      socket.off("draw_move", onDrawMove);
      socket.off("canvas_state", onCanvasState);
      socket.off("public_rooms", onPublicRooms);
      socket.off("server_error", onError);
      socket.off("left_room", onLeftRoom);
    };
  }, []);

  const actions: GameActions = {
    createRoom: (hostName, settings) => socket.emit("create_room", { hostName, settings }),
    joinRoom: (roomId, playerName) => socket.emit("join_room", { roomId, playerName }),
    leaveRoom: () => socket.emit("leave_room"),
    setReady: (ready) => socket.emit("player_ready", { ready }),
    updateSettings: (settings) => socket.emit("update_settings", { settings }),
    startGame: () => socket.emit("start_game"),
    chooseWord: (word) => socket.emit("word_chosen", { word }),
    sendDrawStart: (point, color, size, tool) =>
      socket.emit("draw_start", { color, size, tool, point }),
    sendDrawMove: (point) => socket.emit("draw_move", { point }),
    endStroke: () => socket.emit("draw_end"),
    undoStroke: () => socket.emit("draw_undo"),
    clearCanvas: () => socket.emit("canvas_clear"),
    submitMessage: (text, isGuess) => socket.emit(isGuess ? "guess" : "chat", { text }),
  };

  return {
    connected,
    playerId,
    room,
    messages,
    publicRooms,
    error,
    reportError: setError,
    dismissError: () => setError(""),
    actions,
  };
}
