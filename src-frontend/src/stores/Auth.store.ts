import { create } from "zustand";
import { useIndexStore } from "./Index.store";

const API_BASE_URL = import.meta.env.DEV ? "http://localhost:3000/api" : "/api";

type UserSession = {
  id: string;
  user: {
    username: string | null;
    firstName: string | null;
    lastName: string | null;
  };
};

type Store = {
  sessionId: string | null;
  user: {
    username: string | null;
    firstName: string | null;
    lastName: string | null;
  };
  sessions: UserSession[];
  login: (
    phone: string,
    pin: string,
  ) => Promise<{ success: boolean; message?: string }>;
  register: (code: string) => Promise<{ success: boolean; message?: string }>;
  init: () => Promise<void>;
  logout: () => Promise<void>;
  sendOtp: (phone: string) => Promise<{ success: boolean; message?: string }>;
  setPin: (pin: string) => Promise<{ success: boolean; message?: string }>;
  switchSession: (sessionId: string) => Promise<void>;
};

export const useAuthStore = create<Store>()((set, get) => ({
  sessionId: null,
  user: {
    username: null,
    firstName: null,
    lastName: null,
  },
  sessions: JSON.parse(localStorage.getItem("td_sessions") || "[]"),

  login: async (phone: string, pin: string) => {
    const response = await fetch(API_BASE_URL + "/auth/send-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, pin }),
    });
    const data = await response.json();
    if (!response.ok)
      return { success: false, message: data.error?.message || "Login failed" };

    const sessionId = data.session_id;
    await (window as any).cookieStore?.set({
      name: "session_id",
      value: sessionId,
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    const meRes = await fetch(API_BASE_URL + "/auth/me", {
      headers: { "x-session-id": sessionId },
    });
    const meData = await meRes.json();

    const newUser = {
      username: meData.user.username,
      firstName: meData.user.firstName,
      lastName: meData.user.lastName,
    };

    const newSession: UserSession = { id: sessionId, user: newUser };
    const currentSessions = get().sessions.filter((s) => s.id !== sessionId);
    const updatedSessions = [...currentSessions, newSession];

    set({ sessionId, user: newUser, sessions: updatedSessions });
    localStorage.setItem("td_sessions", JSON.stringify(updatedSessions));

    return { success: true };
  },

  register: async (code: string) => {
    const sessionId = get().sessionId;
    const response = await fetch(API_BASE_URL + "/auth/sign-in", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-id": sessionId || "",
      },
      body: JSON.stringify({ code }),
    });
    const data = await response.json();
    if (!response.ok)
      return { success: false, message: data.error?.message || "Login failed" };

    const meRes = await fetch(API_BASE_URL + "/auth/me", {
      headers: { "x-session-id": sessionId || "" },
    });
    const meData = await meRes.json();

    const newUser = {
      username: meData.user.username,
      firstName: meData.user.firstName,
      lastName: meData.user.lastName,
    };

    const newSession: UserSession = { id: sessionId!, user: newUser };
    const currentSessions = get().sessions.filter((s) => s.id !== sessionId);
    const updatedSessions = [...currentSessions, newSession];

    set({ user: newUser, sessions: updatedSessions });
    localStorage.setItem("td_sessions", JSON.stringify(updatedSessions));

    await (window as any).cookieStore?.set({
      name: "session_id",
      value: sessionId,
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    const { refreshIndex } = useIndexStore.getState();
    refreshIndex();
    return { success: true };
  },

  init: async () => {
    const cookie = await (window as any).cookieStore?.get("session_id");
    let sessionId = cookie?.value;
    let foundValid = false;

    // Helper to validate and set a session
    const validate = async (sid: string) => {
      const response = await fetch(API_BASE_URL + "/auth/me", {
        headers: { "x-session-id": sid },
      });
      if (response.ok) {
        const data = await response.json();
        const user = {
          username: data.user.username,
          firstName: data.user.firstName,
          lastName: data.user.lastName,
        };
        set({ sessionId: sid, user });

        // Update cookie to ensure it's active
        await (window as any).cookieStore?.set({
          name: "session_id",
          value: sid,
          expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
          path: "/",
        });

        // Ensure it's in the sessions list
        const current = get().sessions;
        if (!current.find((s) => s.id === sid)) {
          const updated = [...current, { id: sid, user }];
          set({ sessions: updated });
          localStorage.setItem("td_sessions", JSON.stringify(updated));
        }
        return true;
      }
      return false;
    };

    // 1. Try current session from cookie
    if (sessionId) {
      foundValid = await validate(sessionId);
    }

    // 2. If cookie failed or doesn't exist, try all stored sessions one by one
    if (!foundValid) {
      const storedSessions = get().sessions;
      const validSessions: UserSession[] = [];
      const deadSessions: string[] = [];

      for (const s of storedSessions) {
        // Skip the one we already tried if it failed
        if (s.id === sessionId) {
          deadSessions.push(s.id);
          continue;
        }

        if (!foundValid && await validate(s.id)) {
          foundValid = true;
          validSessions.push(s);
        } else if (!foundValid) {
          // If we haven't found a valid one yet and this one is dead, mark for cleanup
          deadSessions.push(s.id);
        }
      }

      // Cleanup dead sessions from the list
      if (deadSessions.length > 0) {
        const filtered = get().sessions.filter(s => !deadSessions.includes(s.id));
        set({ sessions: filtered });
        localStorage.setItem("td_sessions", JSON.stringify(filtered));
      }

      // If we didn't find any valid session anywhere, clear active state
      if (!foundValid) {
        await (window as any).cookieStore?.delete("session_id");
        set({
          sessionId: null,
          user: { username: null, firstName: null, lastName: null },
        });
      }
    }
  },

  logout: async () => {
    const sessionId = get().sessionId;
    const updatedSessions = get().sessions.filter((s) => s.id !== sessionId);
    set({
      sessionId: null,
      user: { username: null, firstName: null, lastName: null },
      sessions: updatedSessions,
    });
    localStorage.setItem("td_sessions", JSON.stringify(updatedSessions));
    await (window as any).cookieStore?.delete("session_id");
  },

  switchSession: async (sessionId: string) => {
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session) return;

    await (window as any).cookieStore?.set({
      name: "session_id",
      value: sessionId,
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    set({ sessionId, user: session.user });
    const { fetchData } = useIndexStore.getState();
    fetchData();
  },

  sendOtp: async (phone: string) => {
    const response = await fetch(API_BASE_URL + "/auth/send-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const data = await response.json();
    if (!response.ok)
      return { success: false, message: data.error?.message || "OTP failed" };
    set({ sessionId: data.session_id });
    return { success: true };
  },

  setPin: async (pin: string) => {
    const { sessionId } = get();
    if (!sessionId) return { success: false, message: "No session" };
    const response = await fetch(API_BASE_URL + "/auth/set-pin", {
      method: "POST",
      headers: { "x-session-id": sessionId, "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    if (!response.ok) return { success: false, message: "Failed to set PIN" };
    return { success: true };
  },
}));
