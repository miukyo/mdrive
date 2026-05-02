import { create } from "zustand";

const API_BASE_URL = import.meta.env.DEV ? "http://localhost:3000/api" : "/api";

type Store = {
	sessionId: string | null;
	user: {
		username: string | null;
		firstName: string | null;
		lastName: string | null;
	};
	login: (
		phone: string,
		pin: string,
	) => Promise<{ success: boolean; message?: string }>;
	register: (
		code: string,
	) => Promise<{ success: boolean; message?: string }>;
	init: () => Promise<void>;
	logout: () => Promise<void>;
	sendOtp: (phone: string) => Promise<{ success: boolean; message?: string }>;
	setPin: (pin: string) => Promise<{ success: boolean; message?: string }>;
};

// No need for helper functions as we'll use the native cookieStore API

export const useAuthStore = create<Store>()((set) => ({
	sessionId: null,
	user: {
		username: null,
		firstName: null,
		lastName: null,
	},
	login: async (phone: string, pin: string) => {
		const response = await fetch(API_BASE_URL + "/auth/send-code", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ phone, pin }),
		});
		const data = await response.json();
		if (!response.ok) {
			return { success: false, message: data.error?.message || data.error || "Login failed" };
		}
		set({
			sessionId: data.session_id,
		});
		await (window as any).cookieStore?.set({
			name: "session_id",
			value: data.session_id,
			expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
			path: "/",
		});
		const response2 = await fetch(API_BASE_URL + "/auth/me", {
			headers: {
				"Content-Type": "application/json",
				"x-session-id": data.session_id,
			},
		});
		const data2 = await response2.json();
		if (!response2.ok) {
			return { success: false, message: data2.error?.message || data2.error || "Login failed" };
		}
		set({
			user: {
				username: data2.user.username,
				firstName: data2.user.firstName,
				lastName: data2.user.lastName,
			},
		});
		return { success: true };
	},
	register: async (code: string) => {
		const sessionId = useAuthStore.getState().sessionId;
		const response = await fetch(API_BASE_URL + "/auth/sign-in", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-session-id": sessionId || "",
			},
			body: JSON.stringify({ code }),
		});
		const data = await response.json();
		if (!response.ok) {
			return {
				success: false,
				message: data.error?.message || data.error || "Registration failed",
			};
		}
		set({
			sessionId: sessionId,
		});
		await (window as any).cookieStore?.set({
			name: "session_id",
			value: sessionId,
			expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
			path: "/",
		});
		const response2 = await fetch(API_BASE_URL + "/auth/me", {
			headers: {
				"Content-Type": "application/json",
				"x-session-id": sessionId || "",
			},
		});
		const data2 = await response2.json();
		if (!response2.ok) {
			return { success: false, message: data2.error?.message || data2.error || "Login failed" };
		}
		set({
			user: {
				username: data2.user.username,
				firstName: data2.user.firstName,
				lastName: data2.user.lastName,
			},
		});
		return { success: true };
	},
	sendOtp: async (phone: string) => {
		const response = await fetch(API_BASE_URL + "/auth/send-code", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ phone }),
		});
		const data = await response.json();
		if (!response.ok) {
			return { success: false, message: data.error?.message || data.error || "Failed to send OTP" };
		}
		set({ sessionId: data.session_id });
		return { success: true, sessionId: data.session_id };
	},
	init: async () => {
		const cookie = await (window as any).cookieStore?.get("session_id");
		const sessionId = cookie?.value;
		if (sessionId) {
			const response = await fetch(API_BASE_URL + "/auth/me", {
				headers: {
					"Content-Type": "application/json",
					"x-session-id": sessionId,
				},
			});
			if (response.ok) {
				const data = await response.json();
				set({
					sessionId: sessionId,
					user: {
						username: data.user.username,
						firstName: data.user.firstName,
						lastName: data.user.lastName,
					},
				});
			} else {
				await (window as any).cookieStore?.delete("session_id");
			}
		}
	},
	logout: async () => {
		await (window as any).cookieStore?.delete("session_id");
		set({
			sessionId: null,
			user: {
				username: null,
				firstName: null,
				lastName: null,
			},
		});
	},
	setPin: async (pin: string) => {
		const { sessionId } = useAuthStore.getState();
		if (!sessionId) {
			return { success: false, message: "No active session" };
		}
		const response = await fetch(API_BASE_URL + "/auth/set-pin", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-session-id": sessionId,
			},
			body: JSON.stringify({ pin }),
		});
		const data = await response.json();
		if (!response.ok) {
			return { success: false, message: data.error?.message || data.error || "Failed to set PIN" };
		}
		return { success: true };
	},
}));
