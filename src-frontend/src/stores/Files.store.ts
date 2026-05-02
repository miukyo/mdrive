import { create } from "zustand";
import { useAuthStore } from "./Auth.store";

const API_BASE_URL = import.meta.env.DEV ? "http://localhost:3000/api" : "/api";

type Store = {
	getFiles: (folderId?: number) => Promise<{ success: boolean; data?: any; message?: string }>;
	uploadFiles: (files: FileList | File[], folderId?: number, transferIds?: string[]) => Promise<{ success: boolean; message?: string }>;
	deleteFiles: (messageIds: number[], folderId?: number) => Promise<{ success: boolean; message?: string }>;
	moveFiles: (messageIds: number[], sourceFolderId: number | null, targetFolderId: number | null) => Promise<{ success: boolean; message?: string }>;
};

export const useFilesStore = create<Store>()((set) => ({
	getFiles: async (folderId?: number) => {
		const { sessionId } = useAuthStore.getState();
		if (!sessionId) return { success: false, message: "No active session" };

		const url = new URL(API_BASE_URL + "/files");
		if (folderId !== undefined) url.searchParams.append("folder_id", folderId.toString());

		const response = await fetch(url.toString(), {
			headers: { "x-session-id": sessionId },
		});
		const data = await response.json();
		if (!response.ok) return { success: false, message: data.error?.message || "Failed to fetch files" };
		return { success: true, data: data.data };
	},
	uploadFiles: async (files: FileList | File[], folderId?: number, transferIds?: string[]) => {
		const { sessionId } = useAuthStore.getState();
		if (!sessionId) return { success: false, message: "No active session" };

		const formData = new FormData();
		Array.from(files).forEach((file) => formData.append("files", file));
		if (folderId !== undefined) formData.append("folder_id", folderId.toString());
		if (transferIds) transferIds.forEach(id => formData.append("transfer_ids", id));

		const response = await fetch(API_BASE_URL + "/files/upload", {
			method: "POST",
			headers: { "x-session-id": sessionId },
			body: formData,
		});
		const data = await response.json();
		if (!response.ok) return { success: false, message: data.error?.message || "Upload failed" };
		return { success: true };
	},
	deleteFiles: async (messageIds: number[], folderId?: number) => {
		const { sessionId } = useAuthStore.getState();
		if (!sessionId) return { success: false, message: "No active session" };

		const response = await fetch(API_BASE_URL + "/files", {
			method: "DELETE",
			headers: {
				"Content-Type": "application/json",
				"x-session-id": sessionId,
			},
			body: JSON.stringify({ message_ids: messageIds, folder_id: folderId }),
		});
		const data = await response.json();
		if (!response.ok) return { success: false, message: data.error?.message || "Delete failed" };
		return { success: true };
	},
	moveFiles: async (messageIds: number[], sourceFolderId: number | null, targetFolderId: number | null) => {
		const { sessionId } = useAuthStore.getState();
		if (!sessionId) return { success: false, message: "No active session" };

		const response = await fetch(API_BASE_URL + "/files/move", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-session-id": sessionId,
			},
			body: JSON.stringify({
				message_ids: messageIds,
				source_folder_id: sourceFolderId,
				target_folder_id: targetFolderId,
			}),
		});
		const data = await response.json();
		if (!response.ok) return { success: false, message: data.error?.message || "Move failed" };
		return { success: true };
	},
}));