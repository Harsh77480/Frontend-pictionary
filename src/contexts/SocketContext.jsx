import React, { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const backendUrl = import.meta.env.VITE_BACKEND_URL;
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // create socket once and clean up on unmount
    const s = io(backendUrl, {
      transports: [ "websocket"]
    });
    setSocket(s);

    const onError = (err) => console.warn("socket connect_error", err);
    s.on("connect_error", onError);

    return () => {
      s.off("connect_error", onError);
      try { s.close(); } catch (e) { /* ignore */ }
      setSocket(null);
    };
  }, [backendUrl]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}
