import { useEffect, useState } from "react";
import type { ChatMessage, RoomSettings, RoomState } from "../../../shared/protocol.js";
import type { GameActions } from "../../hooks/useGameSocket.js";
import GameBoard from "./GameBoard.js";
import Lobby from "../lobby/Lobby.js";

interface GameRoomProps {
  room: RoomState;
  messages: ChatMessage[];
  playerId: string;
  leaveRoom: () => void;
  showError: (message: string) => void;
  actions: GameActions;
}

export default function GameRoom({
  room,
  messages,
  playerId,
  leaveRoom,
  showError,
  actions,
}: GameRoomProps) {
  const [settingsDraft, setSettingsDraft] = useState(room.settings);
  const [copied, setCopied] = useState(false);
  const isHost = room.hostId === playerId;
  const isDrawer = room.drawerId === playerId;
  const activeDrawer = room.players.find((player) => player.id === room.drawerId);

  useEffect(() => setSettingsDraft(room.settings), [room.settings]);

  const copyInvite = async () => {
    const invite = `${window.location.origin}/?room=${room.roomId}`;
    try {
      await navigator.clipboard.writeText(invite);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      showError("Could not copy the invite link. You can share the room code instead.");
    }
  };

  return (
    <div className="game-shell">
      <header className="game-header">
        <a className="brand-lockup brand-lockup--compact" href="/" aria-label="Scribble Club">
          <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
          <span className="brand-name">scribble<span>club</span></span>
        </a>
        <div className="game-header-center">
          <span className="game-room-label">ROOM</span>
          <strong className="game-room-code">{room.roomId}</strong>
          <button type="button" className="copy-link-button" onClick={copyInvite}>
            {copied ? "Copied!" : "Copy invite"} <span aria-hidden="true">{copied ? "✓" : "↗"}</span>
          </button>
        </div>
        <button type="button" className="leave-button" onClick={leaveRoom}>
          <span aria-hidden="true">←</span> Leave
        </button>
      </header>

      <main className="game-main">
        {room.phase === "lobby" ? (
          <Lobby
            room={room}
            playerId={playerId}
            isHost={isHost}
            settingsDraft={settingsDraft}
            setSettingsDraft={(settings: RoomSettings) => setSettingsDraft(settings)}
            copyInvite={copyInvite}
            actions={actions}
          />
        ) : (
          <GameBoard
            room={room}
            messages={messages}
            playerId={playerId}
            isDrawer={isDrawer}
            activeDrawerName={activeDrawer?.name ?? "Someone"}
            leaveRoom={leaveRoom}
            actions={actions}
          />
        )}
      </main>
    </div>
  );
}
