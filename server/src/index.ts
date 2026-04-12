import http from "node:http";
import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import { config } from "./config.js";
import { twilioRouter, attachMediaStream } from "./phone/twilio.js";

const dashboardOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

const app = express();
app.use(cors({ origin: dashboardOrigins }));
app.use(express.urlencoded({ extended: false })); // Twilio sends form-encoded POST

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: dashboardOrigins,
    methods: ["GET", "POST"],
  },
});

// Hour 0 test — keep until dashboard is wired to real events
io.on("connection", (socket) => {
  console.log("[socket] dashboard connected", socket.id);
  socket.emit("hour0:test", {
    message: "Hello from Present server",
    at: new Date().toISOString(),
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// Twilio routes
app.use(twilioRouter);

// Twilio media stream WebSocket
attachMediaStream(httpServer, io);

httpServer.listen(config.port, () => {
  console.log(`Server listening on http://localhost:${config.port}`);
  if (!config.serverUrl) {
    console.warn(
      "[config] SERVER_URL is empty — Twilio <Stream> URL in TwiML will be wrong. Use `npm run tunnel:server`, set SERVER_URL to the ngrok host, restart the server, then point Voice webhook at https://<host>/api/twilio/voice (see .env.example).",
    );
  }
});
