import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { Server } from 'socket.io';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const PORT = Number(process.env.PORT) || 3001;
const dashboardOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

const app = express();
app.use(cors({ origin: dashboardOrigins }));

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: dashboardOrigins,
    methods: ['GET', 'POST'],
  },
});

/** Hour 0: verify dashboard ↔ server wiring (not part of the 10 production events). */
io.on('connection', (socket) => {
  console.log('[socket] dashboard connected', socket.id);
  socket.emit('hour0:test', {
    message: 'Hello from Present server',
    at: new Date().toISOString(),
  });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

httpServer.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
