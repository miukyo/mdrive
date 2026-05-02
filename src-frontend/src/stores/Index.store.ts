import { create } from "zustand";
import { useAuthStore } from "./Auth.store";

const API_BASE_URL = import.meta.env.DEV ? "http://localhost:3000/api" : "/api";

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
	refreshIndex: () => Promise<{ success: boolean; message?: string }>;
	search: (filters?: SearchFilters) => Promise<{ success: boolean; data?: any; message?: string }>;
	backup: () => Promise<{ success: boolean; message?: string }>;
	restore: () => Promise<{ success: boolean; data?: any; message?: string }>;
	getStats: () => Promise<{ success: boolean; data?: any; message?: string }>;
};

export const useIndexStore = create<Store>()((set) => ({
	refreshIndex: async () => {
		const { sessionId } = useAuthStore.getState();
		if (!sessionId) return { success: false, message: "No active session" };

		const response = await fetch(API_BASE_URL + "/index/refresh", {
			method: "POST",
			headers: { "x-session-id": sessionId },
		});
		const data = await response.json();
		if (!response.ok) return { success: false, message: data.error?.message || "Refresh failed" };
		return { success: true };
	},
	search: async (filters?: SearchFilters) => {
		const { sessionId } = useAuthStore.getState();
		if (!sessionId) return { success: false, message: "No active session" };

		const url = new URL(API_BASE_URL + "/index/search");
		if (filters) {
			Object.entries(filters).forEach(([key, value]) => {
				if (value !== undefined) url.searchParams.append(key, value.toString());
			});
		}

		const response = await fetch(url.toString(), {
			headers: { "x-session-id": sessionId },
		});
		const data = await response.json();
		if (!response.ok) return { success: false, message: data.error?.message || "Search failed" };
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
		if (!response.ok) return { success: false, message: data.error?.message || "Backup failed" };
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
		if (!response.ok) return { success: false, message: data.error?.message || "Restore failed" };
		return { success: true, data: data };
	},
	getStats: async () => {
		const { sessionId } = useAuthStore.getState();
		if (!sessionId) return { success: false, message: "No active session" };

		const response = await fetch(API_BASE_URL + "/index/stats", {
			headers: { "x-session-id": sessionId },
		});
		const data = await response.json();
		if (!response.ok) return { success: false, message: data.error?.message || "Failed to fetch stats" };
		return { success: true, data: data.data };
	},
}));