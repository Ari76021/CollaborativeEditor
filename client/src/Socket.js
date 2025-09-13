// src/Socket.js
import { io } from "socket.io-client";

export const initSocket = async () => {
  const backendUrl = "https://collaborative-editor-coral.vercel.app/";
  const option = {
    forceNew: true,
    reconnectionAttempts: Infinity,
    timeout: 10000,
    transports: ["websocket"],
  };
  return io(backendUrl, option);
};
