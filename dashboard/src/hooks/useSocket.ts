"use client";

import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const url =
  process.env.NEXT_PUBLIC_SOCKET_URL?.replace(/\/$/, "") ||
  "http://localhost:3001";

export type Hour0TestPayload = {
  message: string;
  at: string;
};

export function useSocket() {
  const [socket] = useState(
    () => io(url, { transports: ["websocket", "polling"] }),
  );
  const [connected, setConnected] = useState(false);
  const [hour0Test, setHour0Test] = useState<Hour0TestPayload | null>(null);

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onHour0 = (payload: Hour0TestPayload) => setHour0Test(payload);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("hour0:test", onHour0);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("hour0:test", onHour0);
      socket.disconnect();
    };
  }, [socket]);

  return { socket, connected, hour0Test };
}
