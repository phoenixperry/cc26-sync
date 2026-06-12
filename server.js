// cc26-sync — realtime layout sync for the C&C '26 exhibition boards.
// Holds one shared layout PER ROOM (card positions) in memory and broadcasts
// every change to all viewers in that room over WebSockets. Deploy on Render.
//
// Rooms: clients pick a room via ?room=<name> on the WebSocket URL.
//   - the drag board uses the default room "board"
//   - the floor-plan page uses ?room=floorplan
const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;

// room name -> { layout: {workId:{x,y}}, seeded: bool }
const rooms = new Map();
const getRoom = (name) => {
  if (!rooms.has(name)) rooms.set(name, { layout: {}, seeded: false });
  return rooms.get(name);
};

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  const summary = {};
  for (const [name, r] of rooms) summary[name] = { clients: count(name), seeded: r.seeded };
  res.end(JSON.stringify({ ok: true, rooms: summary }));
});

const wss = new WebSocketServer({ server });
const count = (room) => [...wss.clients].filter(c => c.readyState === 1 && c.room === room).length;

function broadcast(room, obj, except) {
  const msg = JSON.stringify(obj);
  for (const c of wss.clients) if (c.readyState === 1 && c.room === room && c !== except) c.send(msg);
}

wss.on('connection', (ws, req) => {
  let roomName = 'board';
  try { roomName = new URL(req.url, 'http://x').searchParams.get('room') || 'board'; } catch (e) {}
  ws.room = roomName;
  const room = getRoom(roomName);

  ws.send(JSON.stringify({ type: 'init', layout: room.seeded ? room.layout : null, clients: count(roomName) }));
  broadcast(roomName, { type: 'presence', clients: count(roomName) });

  ws.on('message', (data) => {
    let m; try { m = JSON.parse(data); } catch (e) { return; }
    if (m.type === 'seed' && !room.seeded && m.layout) {
      room.layout = m.layout; room.seeded = true;
      broadcast(roomName, { type: 'init', layout: room.layout });
    } else if (m.type === 'move' && m.id && m.pos) {
      room.layout[m.id] = m.pos; room.seeded = true;
      broadcast(roomName, { type: 'move', id: m.id, pos: m.pos }, ws);
    } else if (m.type === 'reset' && m.layout) {
      room.layout = m.layout; room.seeded = true;
      broadcast(roomName, { type: 'init', layout: room.layout }, ws);
    }
  });

  ws.on('close', () => broadcast(roomName, { type: 'presence', clients: count(roomName) }));
});

server.listen(PORT, () => console.log('cc26-sync (multi-room) listening on :' + PORT));
