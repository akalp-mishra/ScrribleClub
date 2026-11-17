import { useState } from "react";
import {
  DRAWING_COLORS,
  type ChatMessage,
  type Point,
  type RoomState,
  type StrokeTool,
} from "../../../shared/protocol.js";
import type { GameActions } from "../../hooks/useGameSocket.js";
import { formatTime } from "../../lib/formatters.js";
import DrawingCanvas from "./DrawingCanvas.js";
import ChatPanel from "./ChatPanel.js";

interface GameBoardProps {
  room: RoomState;
  messages: ChatMessage[];
  playerId: string;
  isDrawer: boolean;
  activeDrawerName: string;
  leaveRoom: () => void;
  actions: GameActions;
}

export default function GameBoard({
  room,
  messages,
  playerId,
  isDrawer,
  activeDrawerName,
  leaveRoom,
  actions,
}: GameBoardProps) {
  const [color, setColor] = useState<string>(DRAWING_COLORS[0]);
  const [size, setSize] = useState(6);
  const [tool, setTool] = useState<StrokeTool>("pen");
  const canDraw = room.phase === "drawing" && isDrawer;
  const canGuess = room.phase === "drawing" && !isDrawer;
  const sortedPlayers = [...room.players].sort((a, b) => b.score - a.score);
  const firstPlace = sortedPlayers[0];

  const sendPoint = (event: "draw_start" | "draw_move", point: Point) => {
    if (event === "draw_start") {
      actions.sendDrawStart(point, color, size, tool);
    } else {
      actions.sendDrawMove(point);
    }
  };

  return (
    <div className="play-layout">
      <section className="play-center">
        <div className="play-status-bar">
          <div className="round-label">
            <span className="round-flower">✳</span>
            <div><small>ROUND</small><strong>{room.round}<i> / {room.settings.rounds}</i></strong></div>
          </div>
          <div className={`turn-status${canDraw ? " turn-status--drawing" : ""}`}>
            <span className="turn-status-dot" />
            {canDraw ? "Your turn to draw!" : `${activeDrawerName} is drawing`}
          </div>
          <div className={`timer-pill${room.timeLeft <= 10 ? " timer-pill--urgent" : ""}`}>
            <span aria-hidden="true">◷</span>
            <strong>{formatTime(room.timeLeft)}</strong>
          </div>
        </div>

        <div className="word-bar">
          <span className="word-label">{isDrawer ? "YOUR WORD" : "GUESS THE WORD"}</span>
          {room.phase === "choosing" ? (
            <span className="word-display word-display--waiting">Word coming up…</span>
          ) : isDrawer && room.settings.wordMode === "hidden" && room.phase === "drawing" ? (
            <span className="word-display word-display--hidden">Hidden mode · draw from memory</span>
          ) : isDrawer && room.currentWord ? (
            <span className="word-display">{room.currentWord}</span>
          ) : (
            <span className="word-display word-display--hint">{room.wordHint || "— — — —"}</span>
          )}
          {room.settings.hints > 0 && room.phase === "drawing" && (
            <span className="hint-count">{room.settings.hints} HINTS</span>
          )}
        </div>

        <div className="canvas-card">
          <div className="canvas-topline">
            <span><i /> LIVE CANVAS</span>
            <span>{canDraw ? "Your masterpiece, your rules" : "Watch the masterpiece unfold"}</span>
          </div>
          <div className="canvas-wrap">
            <DrawingCanvas
              key={room.roomId}
              strokes={room.strokes}
              enabled={canDraw}
              color={color}
              size={size}
              tool={tool}
              onStart={(point) => sendPoint("draw_start", point)}
              onMove={(point) => sendPoint("draw_move", point)}
              onEnd={actions.endStroke}
            />
            <div className="canvas-watermark" aria-hidden="true">SC</div>
            {room.phase === "choosing" && (
              <div className="canvas-overlay">
                {isDrawer ? (
                  <div className="word-picker">
                    <span className="eyebrow eyebrow-small">PICK YOUR PROMPT</span>
                    <h2>What are you drawing?</h2>
                    <p>Choose one. The others will have to guess.</p>
                    <div className="word-choice-list">
                      {(room.wordOptions ?? []).map((word) => (
                        <button
                          type="button"
                          className="word-choice"
                          key={word}
                          onClick={() => actions.chooseWord(word)}
                        >
                          <span>{word}</span><i>↗</i>
                        </button>
                      ))}
                    </div>
                    <small>Choosing automatically in {room.timeLeft}s</small>
                  </div>
                ) : (
                  <div className="waiting-word-card">
                    <div className="thinking-doodle">✳</div>
                    <h2>{activeDrawerName} is picking a word</h2>
                    <p>Get those guessing muscles warmed up.</p>
                    <span className="waiting-dots"><i /><i /><i /></span>
                  </div>
                )}
              </div>
            )}
            {room.phase === "round-end" && (
              <div className="canvas-overlay canvas-overlay--soft">
                <div className="round-result-card">
                  <span className="eyebrow eyebrow-small">{room.lastRound?.solvedBy ? "NICE GUESS!" : "TIME'S UP!"}</span>
                  <h2>{room.lastRound?.word}</h2>
                  <p>
                    {room.lastRound?.solvedBy
                      ? `${room.players.find((player) => player.id === room.lastRound?.solvedBy)?.name ?? "A player"} got it!`
                      : "The word was a tough one."}
                  </p>
                  {room.lastRound?.pointsAwarded ? <strong>+{room.lastRound.pointsAwarded} points</strong> : null}
                </div>
              </div>
            )}
            {room.phase === "game-over" && (
              <div className="canvas-overlay canvas-overlay--soft">
                <div className="game-over-card">
                  <span className="trophy-icon">🏆</span>
                  <span className="eyebrow eyebrow-small">THAT’S A WRAP</span>
                  <h2>{firstPlace?.name ?? "Everyone"} wins!</h2>
                  <p>Thanks for making questionable art with us.</p>
                  <div className="final-score-list">
                    {sortedPlayers.map((player, index) => (
                      <div key={player.id}><span>{index + 1}</span><strong>{player.name}</strong><b>{player.score}</b></div>
                    ))}
                  </div>
                  <button type="button" className="button button-primary" onClick={leaveRoom}>Back to home</button>
                </div>
              </div>
            )}
          </div>
          <div className={`drawing-toolbar${canDraw ? "" : " drawing-toolbar--disabled"}`}>
            <div className="tool-group tool-colors" aria-label="Brush colors">
              {DRAWING_COLORS.map((option) => (
                <button
                  type="button"
                  key={option}
                  className={`color-swatch${color === option ? " color-swatch--selected" : ""}${option === "#ffffff" ? " color-swatch--white" : ""}`}
                  style={{ backgroundColor: option }}
                  aria-label={`Set color ${option}`}
                  aria-pressed={color === option}
                  disabled={!canDraw}
                  onClick={() => { setColor(option); setTool("pen"); }}
                />
              ))}
            </div>
            <span className="toolbar-divider" />
            <div className="tool-group brush-sizes" aria-label="Brush size">
              {[4, 8, 14].map((brushSize) => (
                <button
                  type="button"
                  key={brushSize}
                  className={`brush-size-button${size === brushSize ? " brush-size-button--selected" : ""}`}
                  aria-label={`Brush size ${brushSize}`}
                  aria-pressed={size === brushSize}
                  disabled={!canDraw}
                  onClick={() => setSize(brushSize)}
                >
                  <i style={{ width: brushSize, height: brushSize }} />
                </button>
              ))}
            </div>
            <span className="toolbar-divider toolbar-divider--desktop" />
            <div className="tool-group tool-actions">
              <button
                type="button"
                className={`tool-action${tool === "eraser" ? " tool-action--active" : ""}`}
                disabled={!canDraw}
                onClick={() => setTool(tool === "eraser" ? "pen" : "eraser")}
              >
                <span aria-hidden="true">⌫</span> Eraser
              </button>
              <button type="button" className="tool-action" disabled={!canDraw} onClick={actions.undoStroke}>
                <span aria-hidden="true">↶</span> Undo
              </button>
              <button type="button" className="tool-action tool-action--clear" disabled={!canDraw} onClick={actions.clearCanvas}>
                <span aria-hidden="true">⌧</span> Clear
              </button>
            </div>
          </div>
        </div>
        <div className="canvas-caption">
          <span><span className="caption-spark">✦</span> {canDraw ? "You’ve got this. Probably." : "Every great masterpiece starts somewhere."}</span>
          <span>{room.strokes.length} {room.strokes.length === 1 ? "stroke" : "strokes"}</span>
        </div>
      </section>

      <aside className="game-sidebar">
        <section className="scoreboard-card">
          <div className="sidebar-card-heading">
            <div><span className="eyebrow eyebrow-small">THE LEADERBOARD</span><h2>Top doodlers</h2></div>
            <span className="scoreboard-icon">↗</span>
          </div>
          <div className="score-player-list">
            {sortedPlayers.map((player, index) => (
              <div className={`score-player${player.id === room.drawerId ? " score-player--drawing" : ""}`} key={player.id}>
                <span className={`score-rank ${index === 0 ? "score-rank--first" : ""}`}>{String(index + 1).padStart(2, "0")}</span>
                <span className="score-avatar">{player.name.slice(0, 1).toUpperCase()}</span>
                <div className="score-player-name">
                  <strong>{player.name}{player.id === playerId ? <i> (you)</i> : null}</strong>
                  {player.id === room.drawerId && <small>{isDrawer ? "YOUR TURN" : "DRAWING"}</small>}
                </div>
                <b>{player.score}</b>
              </div>
            ))}
          </div>
        </section>
        <ChatPanel
          messages={messages}
          canGuess={canGuess}
          phase={room.phase}
          onSubmit={actions.submitMessage}
        />
        <div className="sidebar-fun-note"><span>✳</span> No erasing bad guesses. Only bad drawings.</div>
      </aside>
    </div>
  );
}
