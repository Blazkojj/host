import axios from "axios";
import { io } from "socket.io-client";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api"
});

export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    return;
  }

  delete api.defaults.headers.common.Authorization;
};

export const createLogsSocket = (token) =>
  io(window.location.origin, {
    transports: ["websocket"],
    auth: {
      token
    }
  });
