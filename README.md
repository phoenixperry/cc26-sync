# cc26-sync

Tiny realtime server that powers live co-working on the **C&C '26 exhibition
layout board** (`phoenixperry.com/cc26/`). It keeps one shared set of card
positions in memory and broadcasts every drag to all connected viewers over
WebSockets.

## Deploy on Render (free)

1. Push this repo to GitHub (already done if you're reading it there).
2. In the [Render dashboard](https://dashboard.render.com): **New → Web Service**.
3. Connect this repo (`cc26-sync`). Render auto-detects Node via `render.yaml`:
   - Runtime: **Node**
   - Build: `npm install`
   - Start: `npm start`
   - Plan: **Free**
4. Deploy. When it's live you'll get a URL like
   `https://cc26-sync.onrender.com`.
5. Give that URL to whoever maintains the board — it goes into the board's
   `SYNC_URL` as `wss://cc26-sync.onrender.com` (http → ws, https → wss).

## Notes

- **Free tier sleeps** after ~15 min idle and cold-starts (~30–50 s) on the next
  connection. The board auto-reconnects, so it just takes a moment to wake.
- State is **in memory** — a redeploy/restart clears it, and the next viewer to
  connect re-seeds it from their own browser copy. (Render free has no
  persistent disk; this is intentional and fine for a planning board.)
- No auth on the socket — access is gated by the `cc26` password on the board
  page itself.

## Protocol

Client → server: `{type:'seed', layout}`, `{type:'move', id, pos}`, `{type:'reset', layout}`
Server → client: `{type:'init', layout|null, clients}`, `{type:'move', id, pos}`, `{type:'presence', clients}`
