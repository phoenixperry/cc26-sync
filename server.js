// cc26-sync — realtime layout sync for the C&C '26 exhibition board.
// Holds one shared layout (card positions) in memory and broadcasts every
// change to all connected viewers over WebSockets. Deploy on Render.
const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;

let layout = {};       // { workId: {x, y} }
let seeded = false;    // becomes true once any client seeds/edits the layout

const server = http.createServer((req, res) => {
  // Health check + simple status (Render pings this).
  res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify({ ok: true, clients: liveCount(), seeded }));
});

const wss = new WebSocketServer({ server });
const liveCount = () => [...wss.clients].filter(c => c.readyState === 1).length;

function broadcast(obj, except) {
  const msg = JSON.stringify(obj);
  for (const c of wss.clients) if (c.readyState === 1 && c !== except) c.send(msg);
}

wss.on('connection', (ws) => {
  // Send current shared state (or null so the first client can seed it).
  ws.send(JSON.stringify({ type: 'init', layout: seeded ? layout : null, clients: liveCount() }));
  broadcast({ type: 'presence', clients: liveCount() });

  ws.on('message', (data) => {
    let m; try { m = JSON.parse(data); } catch (e) { return; }
    if (m.type === 'seed' && !seeded && m.layout) {
      layout = m.layout; seeded = true;
      broadcast({ type: 'init', layout });                 // hand the seed to everyone
    } else if (m.type === 'move' && m.id && m.pos) {
      layout[m.id] = m.pos; seeded = true;
      broadcast({ type: 'move', id: m.id, pos: m.pos }, ws); // live drag → everyone else
    } else if (m.type === 'reset' && m.layout) {
      layout = m.layout; seeded = true;
      broadcast({ type: 'init', layout }, ws);              // reset/import → everyone else
    }
  });

  ws.on('close', () => broadcast({ type: 'presence', clients: liveCount() }));
});

server.listen(PORT, () => console.log('cc26-sync listening on :' + PORT));
