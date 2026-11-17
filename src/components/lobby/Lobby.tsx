import type { RoomSettings, RoomState } from "../../../shared/protocol.js";
import type { GameActions } from "../../hooks/useGameSocket.js";
import SettingsControls from "../SettingsControls.js";

interface LobbyProps {
  room: RoomState;
  playerId: string;
  isHost: boolean;
  settingsDraft: RoomSettings;
  setSettingsDraft: (settings: RoomSettings) => void;
  copyInvite: () => void;
  actions: GameActions;
}

export default function Lobby({
  room,
  playerId,
  isHost,
  settingsDraft,
  setSettingsDraft,
  copyInvite,
  actions,
}: LobbyProps) {
  const allReady = room.players.every((player) => player.ready);
  const currentPlayer = room.players.find((player) => player.id === playerId);

  return (
    <div className="lobby-layout">
      <section className="lobby-main-card">
        <div className="lobby-welcome">
          <div className="eyebrow"><span className="eyebrow-star">✳</span> THE LOBBY</div>
          <h1>Get your doodle<br /><span>crew together.</span></h1>
          <p>Once everyone’s in and ready, the host can kick things off.</p>
          <div className="invite-strip">
            <div className="invite-icon">↗</div>
            <div><small>YOUR ROOM CODE</small><strong>{room.roomId}</strong></div>
            <button type="button" className="button button-light" onClick={copyInvite}>Copy invite</button>
          </div>
        </div>

        <div className="lobby-players-section">
          <div className="section-title-line">
            <div>
              <span className="eyebrow eyebrow-small">THE LINEUP</span>
              <h2>Players <span className="player-count">{room.players.length}/{room.settings.maxPlayers}</span></h2>
            </div>
            <span className="waiting-indicator"><i /> {allReady ? "All ready!" : "Waiting on the crew"}</span>
          </div>
          <div className="lobby-player-list">
            {room.players.map((player, index) => (
              <PlayerRow
                player={player}
                index={index}
                isHost={player.id === room.hostId}
                key={player.id}
              />
            ))}
            {room.players.length < room.settings.maxPlayers && (
              <div className="waiting-player">
                <span className="waiting-plus">+</span>
                <span>Waiting for a friend to join…</span>
              </div>
            )}
          </div>
          {!isHost && (
            <button
              type="button"
              className={`button ${currentPlayer?.ready ? "button-ready" : "button-primary"} button-wide`}
              onClick={() => actions.setReady(!currentPlayer?.ready)}
            >
              {currentPlayer?.ready ? "You’re ready ✓" : "I’m ready!"}
            </button>
          )}
        </div>
      </section>

      <aside className="lobby-settings-card">
        <div className="lobby-settings-heading">
          <span className="settings-big-icon">⚙</span>
          <div>
            <span className="eyebrow eyebrow-small">{isHost ? "HOST CONTROLS" : "GAME PLAN"}</span>
            <h2>{isHost ? "Set the scene" : "Room settings"}</h2>
          </div>
        </div>
        {isHost ? (
          <>
            <SettingsControls
              settings={settingsDraft}
              onChange={(nextSettings) => {
                setSettingsDraft(nextSettings);
                actions.updateSettings(nextSettings);
              }}
            />
            <button
              type="button"
              className="button button-primary button-wide start-game-button"
              onClick={actions.startGame}
              disabled={room.players.length < 2 || !allReady}
            >
              Start the game <span aria-hidden="true">↗</span>
            </button>
            <small className="host-tip">
              {room.players.length < 2
                ? "You’ll need at least one more player to start."
                : !allReady
                  ? "Everyone needs to be ready first."
                  : "Your crew is ready. Let the doodling begin!"}
            </small>
          </>
        ) : (
          <div className="guest-settings-summary">
            <SettingSummary label="Room type" value={room.settings.visibility} />
            <SettingSummary label="Players" value={`${room.settings.maxPlayers} max`} />
            <SettingSummary label="Rounds" value={String(room.settings.rounds)} />
            <SettingSummary label="Draw time" value={`${room.settings.drawTime} sec`} />
            <SettingSummary label="Word choices" value={String(room.settings.wordCount)} />
            <SettingSummary label="Hints" value={room.settings.hints ? String(room.settings.hints) : "Off"} />
            <SettingSummary label="Word mode" value={room.settings.wordMode} />
            <p className="guest-note">The host is setting things up. Get ready to draw!</p>
          </div>
        )}
      </aside>
    </div>
  );
}

function SettingSummary({ label, value }: { label: string; value: string }) {
  return <div className="setting-summary-row"><span>{label}</span><strong>{value}</strong></div>;
}

function PlayerRow({
  player,
  index,
  isHost,
}: {
  player: RoomState["players"][number];
  index: number;
  isHost: boolean;
}) {
  const avatarClasses = ["avatar-peach", "avatar-lilac", "avatar-mint", "avatar-sky", "avatar-yellow"];
  return (
    <div className="player-row">
      <span className={`player-avatar ${avatarClasses[index % avatarClasses.length]}`}>
        {player.name.slice(0, 1).toUpperCase()}
      </span>
      <div className="player-name-block">
        <strong>{player.name}</strong>
        {isHost && <span className="host-badge">HOST</span>}
      </div>
      <span className={`ready-tag${player.ready ? " ready-tag--yes" : ""}`}>
        {player.ready ? "READY" : "NOT READY"}
      </span>
    </div>
  );
}
