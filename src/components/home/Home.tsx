import type { PublicRoom, RoomSettings } from "../../../shared/protocol.js";
import SettingsControls from "../SettingsControls.js";

interface HomeProps {
  connected: boolean;
  playerName: string;
  setPlayerName: (name: string) => void;
  settings: RoomSettings;
  setSettings: (settings: RoomSettings) => void;
  joinCode: string;
  setJoinCode: (code: string) => void;
  publicRooms: PublicRoom[];
  onCreate: () => void;
  onJoin: (code?: string) => void;
}

export default function Home({
  connected,
  playerName,
  setPlayerName,
  settings,
  setSettings,
  joinCode,
  setJoinCode,
  publicRooms,
  onCreate,
  onJoin,
}: HomeProps) {
  return (
    <div className="home-shell">
      <header className="site-header">
        <a className="brand-lockup" href="/" aria-label="Scribble Club home">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="brand-name">scribble<span>club</span></span>
        </a>
        <span className={`connection-pill${connected ? " is-online" : ""}`}>
          <span />
          {connected ? "Connected" : "Connecting"}
        </span>
      </header>

      <main className="home-main">
        <section className="entry-card home-name-card">
          <label className="field-label" htmlFor="player-name">PLAYER NAME</label>
          <input
            id="player-name"
            className="text-input"
            value={playerName}
            onChange={(event) => setPlayerName(event.target.value)}
            maxLength={20}
            placeholder="Enter your name"
            autoComplete="nickname"
          />
        </section>

        <section className="entry-grid">
          <div className="entry-card create-card">
            <h1 className="home-section-title">Create a room</h1>
            <SettingsControls settings={settings} onChange={setSettings} compact />
            <button type="button" className="button button-primary button-wide" onClick={onCreate}>
              Create room
            </button>
          </div>

          <div className="side-entry-column">
            <section className="entry-card join-card">
              <h2 className="home-section-title">Join with invite code</h2>
              <label className="field-label" htmlFor="room-code">ROOM CODE</label>
              <div className="join-code-row">
                <input
                  id="room-code"
                  className="text-input room-code-input"
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase().slice(0, 8))}
                  maxLength={8}
                  placeholder="Enter room code"
                  autoComplete="off"
                />
                <button type="button" className="button button-dark" onClick={() => onJoin()}>
                  Join
                </button>
              </div>
            </section>

            <section className="public-rooms-card">
              <div className="public-rooms-heading">
                <h2>Open rooms</h2>
                <span className="live-count"><i /> {publicRooms.length}</span>
              </div>
              {publicRooms.length ? (
                <div className="public-room-list">
                  {publicRooms.slice(0, 4).map((publicRoom) => (
                    <button
                      type="button"
                      className="public-room-row"
                      key={publicRoom.roomId}
                      onClick={() => onJoin(publicRoom.roomId)}
                    >
                      <span className="room-swatch">{publicRoom.hostName.slice(0, 1).toUpperCase()}</span>
                      <span className="public-room-info">
                        <strong>{publicRoom.hostName}’s room</strong>
                        <small>
                          {publicRoom.playerCount}/{publicRoom.settings.maxPlayers} players · {publicRoom.settings.rounds} rounds
                        </small>
                      </span>
                      <span className="room-row-arrow">↗</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty-rooms">No open rooms.</div>
              )}
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}
