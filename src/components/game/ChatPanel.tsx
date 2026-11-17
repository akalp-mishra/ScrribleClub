import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ChatMessage, RoomState } from "../../../shared/protocol.js";
import { formatClockTime } from "../../lib/formatters.js";

interface ChatPanelProps {
  messages: ChatMessage[];
  canGuess: boolean;
  phase: RoomState["phase"];
  onSubmit: (text: string, isGuess: boolean) => void;
}

export default function ChatPanel({ messages, canGuess, phase, onSubmit }: ChatPanelProps) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"guess" | "chat">("chat");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    setMode(canGuess ? "guess" : "chat");
  }, [canGuess]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    onSubmit(value, canGuess && mode === "guess");
    setText("");
  };

  return (
    <section className="chat-card">
      <div className="sidebar-card-heading chat-heading">
        <div><span className="eyebrow eyebrow-small">THE GROUP CHAT</span><h2>Say something</h2></div>
        <span className="chat-bubble-icon">···</span>
      </div>
      {canGuess && (
        <div className="chat-mode-switch" role="group" aria-label="Message type">
          <button
            type="button"
            className={mode === "guess" ? "is-selected" : ""}
            aria-pressed={mode === "guess"}
            onClick={() => setMode("guess")}
          >
            Guess
          </button>
          <button
            type="button"
            className={mode === "chat" ? "is-selected" : ""}
            aria-pressed={mode === "chat"}
            onClick={() => setMode("chat")}
          >
            Chat
          </button>
        </div>
      )}
      <div className="chat-message-list" ref={listRef} aria-live="polite">
        {messages.length === 0 ? (
          <div className="chat-empty"><span>☁</span><p>The chat is a blank canvas.</p><small>Break the ice or guess the word!</small></div>
        ) : (
          messages.map((message) => (
            <div className={`chat-message chat-message--${message.kind}`} key={message.id}>
              {message.kind === "system" ? (
                <span className="system-message"><i>✳</i> {message.text}</span>
              ) : (
                <>
                  <span className="chat-message-name">{message.playerName}</span>
                  <span className="chat-message-text">{message.text}</span>
                  <small>{formatClockTime(message.createdAt)}</small>
                </>
              )}
            </div>
          ))
        )}
      </div>
      <form className="chat-input-form" onSubmit={submit}>
        <input
          aria-label="Chat message"
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={240}
          placeholder={canGuess && mode === "guess" ? "Type your guess…" : phase === "drawing" ? "Say something…" : "Send a message…"}
        />
        <button
          type="submit"
          disabled={!text.trim()}
          aria-label={canGuess && mode === "guess" ? "Send guess" : "Send chat message"}
        >
          ↗
        </button>
      </form>
      <div className="chat-input-hint">
        {canGuess && mode === "guess" ? "Guesses are checked automatically." : "Keep it kind, keep it doodly."}
      </div>
    </section>
  );
}
