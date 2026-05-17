import { create } from "zustand";
import { useAuthStore } from "./Auth.store";

const API_BASE_URL = import.meta.env.DEV ? "http://localhost:3002/api" : "/api";

type Store = {
  createShare: (
    type: "file" | "folder",
    folderId?: number,
    messageId?: number,
  ) => Promise<{ success: boolean; url?: string; message?: string }>;
  getShare: (token: string) => Promise<{ success: boolean; message?: string }>;
  getShares: () => Promise<{ success: boolean; data?: any; message?: string }>;
  deleteShare: (
    token: string,
  ) => Promise<{ success: boolean; message?: string }>;
  toggleShare: (
    token: string,
  ) => Promise<{ success: boolean; message?: string }>;
};

export const useShareStore = create<Store>()((set) => ({
  createShare: async (
    type: "file" | "folder",
    folderId?: number,
    messageId?: number,
  ) => {
    const { sessionId } = useAuthStore.getState();
    if (!sessionId) return { success: false, message: "No active session" };

    const response = await fetch(API_BASE_URL + "/share/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-id": sessionId,
      },
      body: JSON.stringify({
        share_type: type,
        folder_id: folderId,
        message_id: messageId,
      }),
    });
    const data = await response.json();
    if (!response.ok)
      return {
        success: false,
        message: data.error?.message || "Failed to create share",
      };
    return { success: true, url: data.url };
  },
  getShares: async () => {
    const { sessionId } = useAuthStore.getState();
    if (!sessionId) return { success: false, message: "No active session" };

    const response = await fetch(API_BASE_URL + "/share", {
      headers: { "x-session-id": sessionId },
    });
    const data = await response.json();
    if (!response.ok)
      return {
        success: false,
        message: data.error?.message || "Failed to fetch shares",
      };
    return { success: true, data: data.data };
  },
  getShare: async (token: string) => {
    // Note: The /share/:token endpoint returns a file stream, not JSON.
    // This fetch is just for testing or triggered download.
    const response = await fetch(API_BASE_URL + `/share/${token}`);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return {
        success: false,
        message: data.error?.message || "Failed to access share",
      };
    }
    return { success: true };
  },
  deleteShare: async (token: string) => {
    const { sessionId } = useAuthStore.getState();
    if (!sessionId) return { success: false, message: "No active session" };

    const response = await fetch(API_BASE_URL + `/share/${token}`, {
      method: "DELETE",
      headers: { "x-session-id": sessionId },
    });
    const data = await response.json();
    if (!response.ok)
      return {
        success: false,
        message: data.error?.message || "Failed to delete share",
      };
    return { success: true };
  },
  toggleShare: async (token: string) => {
    const { sessionId } = useAuthStore.getState();
    if (!sessionId) return { success: false, message: "No active session" };

    const response = await fetch(API_BASE_URL + `/share/${token}/toggle`, {
      method: "PATCH",
      headers: { "x-session-id": sessionId },
    });
    const data = await response.json();
    if (!response.ok)
      return {
        success: false,
        message: data.error?.message || "Failed to toggle share",
      };
    return { success: true };
  },
}));
