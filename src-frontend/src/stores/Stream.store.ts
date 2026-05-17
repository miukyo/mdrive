import { create } from "zustand";
import { useAuthStore } from "./Auth.store";

const API_BASE_URL = import.meta.env.DEV ? "http://localhost:3002/api" : "/api";

type Store = {
  getStreamUrl: (
    messageId: number,
    folderId?: number | null,
    peerId?: number | null,
  ) => string;
  getThumbnailUrl: (
    messageId: number,
    folderId?: number | null,
    peerId?: number | null,
  ) => string;
};

export const useStreamStore = create<Store>()((set) => ({
  getStreamUrl: (
    messageId: number,
    folderId?: number | null,
    peerId?: number | null,
  ) => {
    const { sessionId } = useAuthStore.getState();
    const url = new URL(API_BASE_URL + "/stream", window.location.origin);
    url.searchParams.append("message_id", messageId.toString());
    if (folderId) url.searchParams.append("folder_id", folderId.toString());
    if (peerId) url.searchParams.append("peer_id", peerId.toString());
    if (sessionId) url.searchParams.append("session_id", sessionId);
    return url.toString();
  },
  getThumbnailUrl: (
    messageId: number,
    folderId?: number | null,
    peerId?: number | null,
  ) => {
    const { sessionId } = useAuthStore.getState();
    const url = new URL(API_BASE_URL + "/thumbnail", window.location.origin);
    url.searchParams.append("message_id", messageId.toString());
    if (folderId) url.searchParams.append("folder_id", folderId.toString());
    if (peerId) url.searchParams.append("peer_id", peerId.toString());
    if (sessionId) url.searchParams.append("session_id", sessionId);
    return url.toString();
  },
}));
