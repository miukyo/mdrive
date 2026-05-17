import { create } from "zustand";
import { useAuthStore } from "./Auth.store";

const API_BASE_URL = import.meta.env.DEV ? "http://localhost:3002/api" : "/api";

type SearchFilters = {
  q?: string;
  category?: string;
  folderId?: number;
  startDate?: string;
  endDate?: string;
  ids?: string;
  limit?: number;
  offset?: number;
};

type Store = {
  files: any[];
  stats: any[];
  refreshIndex: () => Promise<{ success: boolean; message?: string }>;
  search: (
    filters?: SearchFilters,
    updateState?: boolean,
  ) => Promise<{ success: boolean; data?: any; message?: string }>;
  backup: () => Promise<{ success: boolean; message?: string }>;
  restore: () => Promise<{ success: boolean; data?: any; message?: string }>;
  getStats: () => Promise<{ success: boolean; data?: any; message?: string }>;
  isLoading: boolean;
  currentFolderId: number;
  selectedKeys: any;
  setCurrentFolderId: (id: number) => void;
  setSelectedKeys: (keys: any) => void;
  isNavigatingFromSearch: boolean;
  setNavigatingFromSearch: (val: boolean) => void;
  fetchData: () => Promise<void>;
  fetchFolderContents: (folderId: number) => Promise<void>;
};

export const useIndexStore = create<Store>()((set, get) => ({
  files: [],
  stats: [],
  isLoading: false,
  currentFolderId: 0,
  selectedKeys: new Set(),
  isNavigatingFromSearch: false,
  setCurrentFolderId: (id: number) => set({ currentFolderId: id }),
  setSelectedKeys: (keys: any) => set({ selectedKeys: keys }),
  setNavigatingFromSearch: (val: boolean) =>
    set({ isNavigatingFromSearch: val }),
  refreshIndex: async () => {
    const { sessionId } = useAuthStore.getState();
    if (!sessionId) return { success: false, message: "No active session" };

    set({ isLoading: true });
    const response = await fetch(API_BASE_URL + "/index/refresh", {
      method: "POST",
      headers: { "x-session-id": sessionId },
    });
    const data = await response.json();
    set({ isLoading: false });
    if (!response.ok)
      return {
        success: false,
        message: data.error?.message || "Refresh failed",
      };
    return { success: true };
  },
  search: async (filters?: SearchFilters, updateState = true) => {
    const { sessionId } = useAuthStore.getState();
    if (!sessionId) return { success: false, message: "No active session" };

    const url = new URL(API_BASE_URL + "/index/search", window.location.origin);
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) url.searchParams.append(key, value.toString());
      });
    }

    if (updateState) set({ isLoading: true });
    const response = await fetch(url.toString(), {
      headers: { "x-session-id": sessionId },
    });
    const data = await response.json();
    if (updateState) set({ isLoading: false });

    if (!response.ok)
      return {
        success: false,
        message: data.error?.message || "Search failed",
      };

    if (updateState) set({ files: data.data });
    return { success: true, data: data.data };
  },
  backup: async () => {
    const { sessionId } = useAuthStore.getState();
    if (!sessionId) return { success: false, message: "No active session" };

    const response = await fetch(API_BASE_URL + "/index/backup", {
      method: "POST",
      headers: { "x-session-id": sessionId },
    });
    const data = await response.json();
    if (!response.ok)
      return {
        success: false,
        message: data.error?.message || "Backup failed",
      };
    return { success: true };
  },
  restore: async () => {
    const { sessionId } = useAuthStore.getState();
    if (!sessionId) return { success: false, message: "No active session" };

    const response = await fetch(API_BASE_URL + "/index/restore", {
      method: "POST",
      headers: { "x-session-id": sessionId },
    });
    const data = await response.json();
    if (!response.ok)
      return {
        success: false,
        message: data.error?.message || "Restore failed",
      };
    return { success: true, data: data };
  },
  getStats: async () => {
    const { sessionId } = useAuthStore.getState();
    if (!sessionId) return { success: false, message: "No active session" };

    set({ isLoading: true });
    const response = await fetch(API_BASE_URL + "/index/stats", {
      headers: { "x-session-id": sessionId },
    });
    const data = await response.json();
    set({ isLoading: false });
    if (!response.ok)
      return {
        success: false,
        message: data.error?.message || "Failed to fetch stats",
      };
    set({ stats: data.data });
    return { success: true, data: data.data };
  },
  fetchData: async () => {
    const { search, getStats } = get();
    await Promise.all([search({ limit: 1000 }), getStats()]);
  },
  fetchFolderContents: async (folderId: number) => {
    const { search } = get();
    await search({ folderId, limit: 1000 });
  },
}));
