"use client";

import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";

const url =
  process.env.NEXT_PUBLIC_SOCKET_URL?.replace(/\/$/, "") ||
  "http://localhost:3001";

export type Hour0TestPayload = {
  message: string;
  at: string;
};

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [hour0Test, setHour0Test] = useState<Hour0TestPayload | null>(null);

  useEffect(() => {
    const s = io(url, { transports: ["websocket", "polling"] });
    setSocket(s);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onHour0 = (payload: Hour0TestPayload) => setHour0Test(payload);

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("hour0:test", onHour0);

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.off("hour0:test", onHour0);
      s.disconnect();
    };
  }, []);

  return { socket, connected, hour0Test };
}
