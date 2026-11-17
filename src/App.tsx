import { lazy, Suspense, useState } from "react";
import {
  DEFAULT_SETTINGS,
  type RoomSettings,
} from "../shared/protocol.js";
import GameLoadingSkeleton from "./components/game/GameLoadingSkeleton.js";
import Home from "./components/home/Home.js";
import { useGameSocket } from "./hooks/useGameSocket.js";

const GameRoom = lazy(() => import("./components/game/GameRoom.js"));

function App() {
  const [playerName, setPlayerName] = useState("");
  const [settings, setSettings] = useState<RoomSettings>(DEFAULT_SETTINGS);
  const [joinCode, setJoinCode] = useState(
    new URLSearchParams(window.location.search).get("room")?.toUpperCase() ?? "",
  );
  const {
    connected,
    playerId,
    room,
    messages,
    publicRooms,
    error,
    reportError,
    dismissError,
    actions,
  } = useGameSocket();

  const requireName = () => {
    const name = playerName.trim();
    if (!name) {
      reportError("Add your name before joining the fun.");
      return null;
    }
    if (!connected) {
      reportError("Connecting to the game server. Try again in a moment.");
      return null;
    }
    return name;
  };

  const createRoom = () => {
    const name = requireName();
    if (!name) return;
    reportError("");
    actions.createRoom(name, settings);
  };

  const joinRoom = (requestedCode = joinCode) => {
    const name = requireName();
    const code = requestedCode.trim().toUpperCase();
    if (!name) return;
    if (!code) {
      reportError("Enter a room code to join.");
      return;
    }
    setJoinCode(code);
    reportError("");
    actions.joinRoom(code, name);
  };

  return (
    <>
      {room ? (
        <Suspense fallback={<GameLoadingSkeleton />}>
          <GameRoom
            room={room}
            messages={messages}
            playerId={playerId}
            leaveRoom={actions.leaveRoom}
            showError={reportError}
            actions={actions}
          />
        </Suspense>
      ) : (
        <Home
          connected={connected}
          playerName={playerName}
          setPlayerName={setPlayerName}
          settings={settings}
          setSettings={setSettings}
          joinCode={joinCode}
          setJoinCode={setJoinCode}
          publicRooms={publicRooms}
          onCreate={createRoom}
          onJoin={joinRoom}
        />
      )}
      {!connected && (
        <div className="connection-banner" role="status">
          Reconnecting to the game server…
        </div>
      )}
      {error && (
        <div className="toast-message" role="alert">
          <span className="toast-dot" />
          {error}
          <button type="button" aria-label="Dismiss message" onClick={dismissError}>
            ×
          </button>
        </div>
      )}
    </>
  );
}

export default App;
