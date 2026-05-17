import { create } from "zustand";
import { useAuthStore } from "./Auth.store";
import { toast } from "@heroui/react";

const API_BASE_URL = import.meta.env.DEV ? "http://localhost:3002/api" : "/api";

type Transfer = {
  id: string;
  name: string;
  percent: number;
  toastId?: string;
};

type ProgressState = {
  transfers: Record<string, Transfer>;
  eventSource: EventSource | null;
  init: () => void;
  startTransfer: (id: string, name: string) => void;
  updateTransfer: (id: string, percent: number) => void;
  finishTransfer: (id: string) => void;
};

const ProgressToast = ({ id }: { id: string }) => {
  const transfer = useProgressStore((state) => state.transfers[id]);
  if (!transfer) return null;
  return (
    <div className="flex flex-col gap-1">
      <span className="font-medium truncate">Uploading {transfer.name}</span>
      <span className="text-xs opacity-80">{transfer.percent}% complete</span>
    </div>
  );
};

export const useProgressStore = create<ProgressState>()((set, get) => ({
  transfers: {},
  eventSource: null,
  init: () => {
    const { sessionId } = useAuthStore.getState();
    const { eventSource: existingSource } = get();
    if (!sessionId || existingSource) return;

    console.log("Connecting to SSE...");
    const eventSource = new EventSource(
      `${API_BASE_URL}/transfers/events?session_id=${sessionId}`,
    );

    eventSource.addEventListener("upload-progress", (e) => {
      console.log("Progress event received:", e.data);
      const data = JSON.parse(e.data);
      get().updateTransfer(data.id, data.percent);
    });

    eventSource.onopen = () => {
      console.log("SSE Connection opened");
    };

    eventSource.onerror = (e) => {
      console.error("SSE Connection error:", e);
      eventSource.close();
      set({ eventSource: null });
      // Reconnect after delay
      setTimeout(() => get().init(), 5000);
    };

    set({ eventSource });
  },

  startTransfer: (id, name) => {
    const toastId = toast(<ProgressToast id={id} />, {
      isLoading: true,
      timeout: 0,
    });

    set((state) => ({
      transfers: {
        ...state.transfers,
        [id]: { id, name, percent: 0, toastId },
      },
    }));
  },

  updateTransfer: (id, percent) => {
    const transfer = get().transfers[id];
    if (!transfer) return;

    set((state) => ({
      transfers: {
        ...state.transfers,
        [id]: { ...transfer, percent },
      },
    }));

    if (percent >= 100) {
      get().finishTransfer(id);
    }
  },

  finishTransfer: (id) => {
    const transfer = get().transfers[id];
    if (!transfer) return;

    if (transfer.toastId) {
      toast.close(transfer.toastId);
      toast.success(`Uploaded ${transfer.name}`, {
        description: "File is now available in your drive",
      });
    }

    set((state) => {
      const newTransfers = { ...state.transfers };
      delete newTransfers[id];
      return { transfers: newTransfers };
    });
  },
}));
