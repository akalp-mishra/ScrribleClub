export default function GameLoadingSkeleton() {
  return (
    <div className="game-loading-shell" role="status" aria-busy="true">
      <span className="visually-hidden">Loading game</span>
      <header className="game-loading-header" aria-hidden="true">
        <span className="skeleton-block skeleton-brand" />
        <span className="skeleton-block skeleton-room-code" />
        <span className="skeleton-block skeleton-header-button" />
      </header>

      <main className="game-loading-layout" aria-hidden="true">
        <section className="game-loading-center">
          <div className="game-loading-status">
            <span className="skeleton-block skeleton-status-short" />
            <span className="skeleton-block skeleton-status-long" />
            <span className="skeleton-block skeleton-timer" />
          </div>
          <div className="skeleton-block skeleton-word" />
          <div className="game-loading-canvas">
            <div className="skeleton-canvas-labels">
              <span className="skeleton-block skeleton-label-short" />
              <span className="skeleton-block skeleton-label-long" />
            </div>
            <div className="skeleton-canvas-board" />
            <div className="skeleton-canvas-toolbar">
              <span className="skeleton-block skeleton-tool-colors" />
              <span className="skeleton-block skeleton-tool-buttons" />
            </div>
          </div>
          <span className="skeleton-block skeleton-caption" />
        </section>

        <aside className="game-loading-sidebar">
          <div className="game-loading-card game-loading-scoreboard">
            <span className="skeleton-block skeleton-card-heading" />
            <span className="skeleton-block skeleton-player-row" />
            <span className="skeleton-block skeleton-player-row" />
            <span className="skeleton-block skeleton-player-row" />
          </div>
          <div className="game-loading-card game-loading-chat">
            <span className="skeleton-block skeleton-card-heading" />
            <span className="skeleton-block skeleton-chat-area" />
            <span className="skeleton-block skeleton-chat-input" />
          </div>
        </aside>
      </main>
    </div>
  );
}
