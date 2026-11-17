# Live Deployed on
https://scrribleclub.onrender.com/


# Scribble Club

A real-time drawing and guessing game built with React, TypeScript, Express, and Socket.IO.

## Run locally

Requirements: Node.js 20.19+ and npm.

```bash
npm install
npm run dev
```

Open the Vite URL printed in the terminal (normally `http://localhost:5173`). The Vite development server proxies API and Socket.IO traffic to the game server on port `3001`.

To run the production build locally:

```bash
npm run build
npm start
```

Open `http://localhost:3001`. The Express server serves the built client and handles Socket.IO connections on the same origin.

## Tech stack

- **Frontend:** React 19 and TypeScript, bundled with Vite 7.
- **Backend:** Node.js and Express 5.
- **Real-time multiplayer:** Socket.IO 4 for room events, drawing synchronization, and chat.
- **Styling:** CSS.
- **Testing:** Vitest 5, including a two-client Socket.IO integration test.
- **Crawler metadata:** `public/robots.txt` and `public/llms.txt` are served from the site root.

## How it works

- The React client renders the lobby, room settings, player list, live canvas, chat, timer, and scores.
- `src/App.tsx` composes the pages, `src/hooks/useGameSocket.ts` owns socket state and actions, and `src/components/` contains the home, lobby, canvas, chat, and game-board UI.
- Express serves the client and a small health/public-room API.
- Socket.IO carries room, game, drawing, and chat events. `server/index.ts` validates incoming events and routes them to the correct room.
- `server/game/GameRoom.ts` owns an individual room's lifecycle and state. `server/game/RoomManager.ts` manages active rooms, and `server/game/validation.ts` validates settings, names, points, and drawing colors.
- `shared/protocol.ts` contains the room settings, game-state, player, message, and drawing types, plus the shared drawing-color palette used by both client and server.
- Drawing is sent as normalized points (0–1) and stroke metadata rather than canvas images. The server stores strokes for the current turn and broadcasts stroke changes; clients redraw the same stroke list on their canvases.
- Guesses are trimmed, whitespace-normalized, and case-insensitive, but must match the complete word. The first correct guess ends the round. Guessers earn 100–500 points based on remaining time; the drawer earns 50 points when the word is solved.
- Every player gets one drawing turn per configured round. A drawing turn ends when the word is solved or the server timer expires.

## Main Socket.IO events

| Event | Direction | Purpose |
| --- | --- | --- |
| `create_room`, `join_room`, `leave_room` | Client → server | Create, join, or leave a room |
| `player_ready`, `update_settings`, `start_game` | Client → server | Lobby actions; host-only actions are checked by the server |
| `word_chosen`, `guess`, `chat` | Client → server | Choose a prompt, submit a guess, or send chat |
| `draw_start`, `draw_move`, `draw_end`, `draw_undo`, `canvas_clear` | Client → server | Drawer-only canvas operations |
| `game_state`, `room_joined`, `public_rooms` | Server → client | Personalized game state and room listings |
| `draw_start`, `draw_move`, `draw_end`, `canvas_state` | Server → room | Synchronized drawing updates |
| `chat_message`, `guess_result`, `server_error` | Server → client/room | Chat, correct-guess result, or a rejected action |

Game state is personalized: word options are sent only to the drawer, and during play the secret word is not included in guessers' state. Public rooms are discoverable; private rooms are omitted from the public list and can be joined using their room code/invite link.

## Tests

```bash
npm test
npm run test:watch
```

Vitest runs the server test suite; use `npm test` for a single run or `npm run test:watch` while developing. The tests cover guess normalization, settings bounds, secret-word privacy, real-time stroke delivery, and scoring through two connected game clients.
