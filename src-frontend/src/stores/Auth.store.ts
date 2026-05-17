import { create } from "zustand";
import { useIndexStore } from "./Index.store";
import { toast } from "@heroui/react";

export const API_BASE_URL = import.meta.env.DEV
  ? "http://localhost:3002/api"
  : "/api";

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
  pendingUser: {
    username: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
  sessions: UserSession[];
  login: (
    phone: string,
    pin: string,
  ) => Promise<{ success: boolean; message?: string }>;
  register: (
    code: string,
  ) => Promise<{
    success: boolean;
    status?: "logged_in" | "password_required";
    message?: string;
  }>;
  login2fa: (
    password: string,
  ) => Promise<{ success: boolean; message?: string }>;
  completeRegistration: () => Promise<void>;
  init: () => Promise<void>;
  logout: () => Promise<void>;
  sendOtp: (phone: string) => Promise<{ success: boolean; message?: string }>;
  setPin: (pin: string) => Promise<{ success: boolean; message?: string }>;
  switchSession: (sessionId: string) => Promise<void>;
  isInitialLoading: boolean;
  loadingMessage: string;
};

export const useAuthStore = create<Store>()((set, get) => ({
  sessionId: null,
  user: {
    username: null,
    firstName: null,
    lastName: null,
  },
  pendingUser: null,
  sessions: JSON.parse(localStorage.getItem("td_sessions:v1") || "[]"),
  isInitialLoading:
    JSON.parse(localStorage.getItem("td_sessions:v1") || "[]").length > 0,
  loadingMessage: "Loading your session...",

  login: async (phone: string, pin: string) => {
    const response = await fetch(API_BASE_URL + "/auth/login", {
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
    localStorage.setItem("td_sessions:v1", JSON.stringify(updatedSessions));

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

    if (data.status === "password_required") {
      return { success: true, status: "password_required" };
    }

    const meRes = await fetch(API_BASE_URL + "/auth/me", {
      headers: { "x-session-id": sessionId || "" },
    });
    const meData = await meRes.json();

    const newUser = {
      username: meData.user.username,
      firstName: meData.user.firstName,
      lastName: meData.user.lastName,
    };

    // Store in pendingUser instead of user to prevent App.tsx from redirecting
    set({ pendingUser: newUser });

    await (window as any).cookieStore?.set({
      name: "session_id",
      value: sessionId,
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    return { success: true, status: "logged_in" };
  },

  login2fa: async (password: string) => {
    const sessionId = get().sessionId;
    if (!sessionId) return { success: false, message: "No active session" };

    const response = await fetch(API_BASE_URL + "/auth/login-2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, password }),
    });
    const data = await response.json();
    if (!response.ok) {
      return {
        success: false,
        message: data.error?.message || "2FA verification failed",
      };
    }

    const meRes = await fetch(API_BASE_URL + "/auth/me", {
      headers: { "x-session-id": sessionId },
    });
    const meData = await meRes.json();

    const newUser = {
      username: meData.user.username,
      firstName: meData.user.firstName,
      lastName: meData.user.lastName,
    };

    set({ pendingUser: newUser });

    await (window as any).cookieStore?.set({
      name: "session_id",
      value: sessionId,
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    return { success: true };
  },

  completeRegistration: async () => {
    const { pendingUser, sessionId, sessions } = get();
    if (!pendingUser || !sessionId) return;

    set({
      isInitialLoading: true,
      loadingMessage: "Indexing your files, please wait...",
    });

    const newSession: UserSession = { id: sessionId, user: pendingUser };
    const currentSessions = sessions.filter((s) => s.id !== sessionId);
    const updatedSessions = [...currentSessions, newSession];

    set({
      user: pendingUser,
      pendingUser: null,
      sessions: updatedSessions,
    });
    localStorage.setItem("td_sessions:v1", JSON.stringify(updatedSessions));

    const { refreshIndex } = useIndexStore.getState();
    let indexSuccess = false;
    let errorMsg = "Indexing failed";

    try {
      const res = await refreshIndex();
      if (res.success) {
        indexSuccess = true;
      } else {
        errorMsg = res.message || "Indexing failed";
      }
    } catch (e: any) {
      console.error("Indexing failed:", e);
      errorMsg = e?.message || "Indexing failed";
    } finally {
      set({
        isInitialLoading: false,
        loadingMessage: "Loading your session...",
      });
    }

    if (!indexSuccess) {
      toast.danger(errorMsg);
      await get().logout();
    }
  },

  init: async () => {
    set({ isInitialLoading: get().sessions.length > 0 });
    const cookie = await (window as any).cookieStore?.get("session_id");
    let sessionId = cookie?.value;
    let foundValid = false;

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

        await (window as any).cookieStore?.set({
          name: "session_id",
          value: sid,
          expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
          path: "/",
        });

        const current = get().sessions;
        if (!current.find((s) => s.id === sid)) {
          const updated = [...current, { id: sid, user }];
          set({ sessions: updated });
          localStorage.setItem("td_sessions:v1", JSON.stringify(updated));
        }
        return true;
      }
      return false;
    };

    try {
      if (sessionId) {
        foundValid = await validate(sessionId);
      }

      if (!foundValid) {
        const storedSessions = get().sessions;
        const validSessions: UserSession[] = [];
        const deadSessions: string[] = [];

        const results = await Promise.all(
          storedSessions.map(async (s) => {
            if (s.id === sessionId) return { id: s.id, valid: false };
            const valid = await validate(s.id);
            return { id: s.id, valid, session: s };
          }),
        );

        for (const res of results) {
          if (res.valid) {
            foundValid = true;
            validSessions.push(res.session!);
          } else {
            deadSessions.push(res.id);
          }
        }

        if (deadSessions.length > 0) {
          const filtered = get().sessions.filter(
            (s) => !deadSessions.includes(s.id),
          );
          set({ sessions: filtered });
          localStorage.setItem("td_sessions:v1", JSON.stringify(filtered));
        }

        if (!foundValid) {
          await (window as any).cookieStore?.delete("session_id");
          set({
            sessionId: null,
            user: { username: null, firstName: null, lastName: null },
          });
        }
      }
    } finally {
      set({ isInitialLoading: false });
    }
  },

  logout: async () => {
    const sessionId = get().sessionId;
    if (sessionId) {
      try {
        await fetch(API_BASE_URL + "/auth/logout", {
          method: "POST",
          headers: { "x-session-id": sessionId },
        });
      } catch (e) {
        console.error("Failed to logout from server:", e);
      }
    }

    const updatedSessions = get().sessions.filter((s) => s.id !== sessionId);
    set({
      sessionId: null,
      user: { username: null, firstName: null, lastName: null },
      sessions: updatedSessions,
    });
    localStorage.setItem("td_sessions:v1", JSON.stringify(updatedSessions));
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
      headers: {
        "x-session-id": sessionId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pin }),
    });
    if (!response.ok) return { success: false, message: "Failed to set PIN" };
    return { success: true };
  },
}));
