import { create } from "zustand";
import { useAuthStore } from "./Auth.store";

const API_BASE_URL = import.meta.env.DEV ? "http://localhost:3000/api" : "/api";

type Store = {
	getFolders: () => Promise<{ success: boolean; data?: any; message?: string }>;
	createFolder: (name: string, parentId?: number) => Promise<{ success: boolean; data?: any; message?: string }>;
	deleteFolder: (id: number) => Promise<{ success: boolean; message?: string }>;
};

export const useFolderStore = create<Store>()((set) => ({
	getFolders: async () => {
		const { sessionId } = useAuthStore.getState();
		if (!sessionId) return { success: false, message: "No active session" };

		const response = await fetch(API_BASE_URL + "/folders", {
			headers: { "x-session-id": sessionId },
		});
		const data = await response.json();
		if (!response.ok) return { success: false, message: data.error?.message || "Failed to fetch folders" };
		return { success: true, data: data.data };
	},
	createFolder: async (name: string, parentId?: number) => {
		const { sessionId } = useAuthStore.getState();
		if (!sessionId) return { success: false, message: "No active session" };

		const response = await fetch(API_BASE_URL + "/folders", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-session-id": sessionId,
			},
			body: JSON.stringify({ name, parent_id: parentId }),
		});
		const data = await response.json();
		if (!response.ok) return { success: false, message: data.error?.message || "Failed to create folder" };
		return { success: true, data: data.data };
	},
	deleteFolder: async (id: number) => {
		const { sessionId } = useAuthStore.getState();
		if (!sessionId) return { success: false, message: "No active session" };

		const response = await fetch(API_BASE_URL + `/folders/${id}`, {
			method: "DELETE",
			headers: { "x-session-id": sessionId },
		});
		const data = await response.json();
		if (!response.ok) return { success: false, message: data.error?.message || "Failed to delete folder" };
		return { success: true };
	},
}));