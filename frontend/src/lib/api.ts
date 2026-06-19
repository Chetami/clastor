import axios from "axios";
import { API_URL, TOKEN_KEY } from "@/config";
import type { ApiError } from "@examify-tms/interfaces";

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  if (config.headers.has("Authorization")) {
    return config;
  }

  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error)) {
      const apiError: ApiError = error.response?.data ?? {
        message: "An unexpected error occurred",
      };
      return Promise.reject(new Error(apiError.message));
    }
    return Promise.reject(error);
  },
);
