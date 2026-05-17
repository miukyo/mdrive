import { create } from "zustand";
import { useAuthStore } from "./Auth.store";
import { useIndexStore } from "./Index.store";
import { useProgressStore } from "./Progress.store";

const API_BASE_URL =
  import.meta.env.DEV ? "http://localhost:3000/api" : "/api";

type Store = {
  getFiles: (
    folderId?: number,
  ) => Promise<{ success: boolean; data?: any; message?: string }>;
  uploadFiles: (
    files: FileList | File[],
    folderId?: number,
    transferIds?: string[],
  ) => Promise<{ success: boolean; message?: string }>;
  deleteFiles: (
    messageIds: number[],
  ) => Promise<{ success: boolean; message?: string }>;
  moveFiles: (
    messageIds: number[],
    targetFolderId: number | null,
  ) => Promise<{ success: boolean; message?: string }>;
  renameFile: (
    messageId: number,
    newName: string,
    folderId?: number,
  ) => Promise<{ success: boolean; message?: string }>;
  shareFile: (
    messageId: number,
    folderId?: number,
  ) => Promise<{ success: boolean; url?: string; message?: string }>;
};

export const useFilesStore = create<Store>()((set) => ({
  getFiles: async (folderId?: number) => {
    const { sessionId } = useAuthStore.getState();
    if (!sessionId) return { success: false, message: "No active session" };

    const url = new URL(API_BASE_URL + "/files", window.location.origin);
    if (folderId !== undefined)
      url.searchParams.append("folder_id", folderId.toString());

    const response = await fetch(url.toString(), {
      headers: { "x-session-id": sessionId },
    });
    const data = await response.json();
    if (!response.ok)
      return {
        success: false,
        message: data.error?.message || "Failed to fetch files",
      };
    return { success: true, data: data.data };
  },
  uploadFiles: async (
    files: FileList | File[],
    folderId?: number,
    transferIds?: string[],
  ) => {
    const { sessionId } = useAuthStore.getState();
    if (!sessionId) return { success: false, message: "No active session" };

    const formData = new FormData();
    const tIds: string[] = [];
    Array.from(files).forEach((file) => {
      const tid = Math.random().toString(36).substring(7);
      formData.append("files", file);
      formData.append("transfer_ids", tid);
      tIds.push(tid);
      
      // Notify progress store
      useProgressStore.getState().startTransfer(tid, file.name);
    });

    if (folderId !== undefined)
      formData.append("folder_id", folderId.toString());
    
    // transfer_ids already appended in the loop above

    // Give UI time to render toasts before starting heavy upload
    await new Promise((r) => setTimeout(r, 100));

    // Use XMLHttpRequest to track upload progress (0-50%)
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", API_BASE_URL + "/files/upload");
      xhr.setRequestHeader("x-session-id", sessionId);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const localPercent = (event.loaded / event.total) * 100;
          // Local upload represents the first 50%
          const storePercent = Math.round(localPercent * 0.5);

          // Update all involved transfers
          tIds.forEach((tid) => {
            useProgressStore.getState().updateTransfer(tid, storePercent);
          });
        }
      };

      xhr.onload = async () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) {
            // Trigger UI updates
            const { fetchData } = useIndexStore.getState();
            fetchData();
            resolve({ success: true });
          } else {
            resolve({
              success: false,
              message: data.error?.message || "Upload failed",
            });
          }
        } catch (e) {
          resolve({ success: false, message: "Server error during upload" });
        }
      };

      xhr.onerror = () => {
        resolve({ success: false, message: "Network error during upload" });
      };

      xhr.send(formData);
    });
  },
  deleteFiles: async (messageIds: number[]) => {
    const { sessionId } = useAuthStore.getState();
    if (!sessionId) return { success: false, message: "No active session" };

    const response = await fetch(API_BASE_URL + "/files/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-id": sessionId,
      },
      body: JSON.stringify({ message_ids: messageIds }),
    });
    const data = await response.json();
    if (!response.ok)
      return {
        success: false,
        message: data.error?.message || "Delete failed",
      };

    // Update store locally
    useIndexStore.setState((state) => ({
      files: state.files.filter((f) => !messageIds.includes(f.id)),
    }));

    return { success: true };
  },
  moveFiles: async (
    messageIds: number[],
    targetFolderId: number | null,
  ) => {
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
        to_folder_id: targetFolderId,
      }),
    });
    const data = await response.json();
    if (!response.ok)
      return { success: false, message: data.error?.message || "Move failed" };

    // Update store locally (remove from current view as it moved)
    useIndexStore.setState((state) => ({
      files: state.files.filter((f) => !messageIds.includes(f.id)),
    }));

    return { success: true };
  },
  renameFile: async (messageId: number, newName: string, folderId?: number) => {
    const { sessionId } = useAuthStore.getState();
    if (!sessionId) return { success: false, message: "No active session" };

    const response = await fetch(API_BASE_URL + "/files/rename", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-id": sessionId,
      },
      body: JSON.stringify({
        message_id: messageId,
        folder_id: folderId,
        name: newName,
      }),
    });
    const data = await response.json();
    if (!response.ok)
      return { success: false, message: data.error?.message || "Rename failed" };

    // Update store locally
    useIndexStore.setState((state) => ({
      files: state.files.map((f) =>
        f.id === messageId ? { ...f, name: newName } : f,
      ),
    }));

    return { success: true };
  },
  shareFile: async (messageId: number, folderId?: number) => {
    const { sessionId } = useAuthStore.getState();
    if (!sessionId) return { success: false, message: "No active session" };

    const isFolder = messageId === 0 && folderId !== undefined;

    const response = await fetch(API_BASE_URL + "/share/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-id": sessionId,
      },
      body: JSON.stringify({
        share_type: isFolder ? "folder" : "file",
        message_id: isFolder ? undefined : messageId,
        folder_id: folderId,
      }),
    });
    const data = await response.json();
    if (!response.ok)
      return { success: false, message: data.error?.message || "Share failed" };

    const fullUrl = `${window.location.origin}${data.url}`;
    return { success: true, url: fullUrl };
  },
}));