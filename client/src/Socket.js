// src/Socket.js
import { io } from "socket.io-client";

export const initSocket = async () => {
  const backendUrl = process.env.REACT_APP_BACKEND_URL || "http://localhost:3000";
  const option = {
    forceNew: true,
    reconnectionAttempts: Infinity,
    timeout: 10000,
    transports: ["websocket"],
  };
  return io(backendUrl, option);
};
