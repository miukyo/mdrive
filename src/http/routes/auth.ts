import { Elysia, t } from "elysia";
import { ApiError } from "../errors.js";
import {
  getTelegramClient,
  logoutAndDestroySession,
  removeTelegramClient,
} from "../../services/telegram.js";
import {
  createOrUpdateSession,
  getSession,
  getActiveSessionByPhone,
  deleteOtherSessionsByPhone,
} from "../../repositories/sessions.js";
import crypto from "node:crypto";
import { Api } from "telegram";
import { config } from "../../config.js";
import { refreshIndex } from "../../services/indexer.js";

export const authRouter = new Elysia({ prefix: "/auth" })
  .post("/send-code", async ({ body: { phone, force_sms, pin } }) => {
    if (!phone) {
      throw new ApiError(400, "phone is required");
    }

    if (!force_sms) {
      const existing = await getActiveSessionByPhone(phone);
      if (existing && existing.pin) {
        if (pin) {
          if (existing.pin === pin) {
            return { session_id: existing.id, status: "logged_in" };
          } else {
            throw new ApiError(403, "Invalid PIN");
          }
        }
        return { session_id: existing.id, status: "pin_required" };
      } else if (pin && !existing) {
        throw new ApiError(403, "Session not found");
      }
    }

    const api_id = config.TELEGRAM_API_ID;
    const api_hash = config.TELEGRAM_API_HASH;

    if (!api_id || !api_hash) {
      throw new ApiError(
        500,
        "Server is missing TELEGRAM_API_ID or TELEGRAM_API_HASH configuration",
      );
    }

    const sessionId = crypto.randomUUID();
    const client = await getTelegramClient(sessionId);
    const { phoneCodeHash } = await client.sendCode(
      { apiId: api_id, apiHash: api_hash },
      phone,
    );

    await createOrUpdateSession({
      id: sessionId,
      phone,
      phone_code_hash: phoneCodeHash,
      auth_state: "pending_code",
    });

    return { session_id: sessionId, status: "code_sent" };
  }, {
    body: t.Object({
      phone: t.String({ description: "Phone number in international format" }),
      force_sms: t.Optional(t.Boolean({ default: false })),
      pin: t.Optional(t.String({ description: "Optional PIN for quick login" })),
    }),
    detail: {
      summary: "Send authentication code",
      tags: ["Auth"],
    }
  })
  .post("/verify-code", async ({ body: { session_id, code } }) => {
    const session = await getSession(session_id);
    if (!session || !session.phone_code_hash) {
      throw new ApiError(400, "Invalid session or missing phone_code_hash");
    }

    const client = await getTelegramClient(session_id);

    try {
      await client.invoke(
        new Api.auth.SignIn({
          phoneNumber: session.phone,
          phoneCodeHash: session.phone_code_hash,
          phoneCode: code,
        }),
      );

      const newSessionString = client.session.save() as unknown as string;
      const updates: any = {
        id: session_id,
        auth_state: "logged_in",
        session_string: newSessionString,
      };

      await createOrUpdateSession(updates);
      const deletedIds = await deleteOtherSessionsByPhone(
        session.phone,
        session_id,
      );
      for (const id of deletedIds) {
        await removeTelegramClient(id);
      }
      refreshIndex(session_id).catch(console.error);
      return { status: "logged_in" };
    } catch (err: any) {
      if (err.message.includes("SESSION_PASSWORD_NEEDED")) {
        await createOrUpdateSession({
          id: session_id,
          auth_state: "pending_password",
        });
        return { status: "password_required" };
      } else {
        throw new ApiError(500, err.message);
      }
    }
  }, {
    body: t.Object({
      session_id: t.String(),
      code: t.String({ description: "The verification code received via Telegram/SMS" }),
    }),
    detail: {
      summary: "Verify authentication code",
      tags: ["Auth"],
    }
  })
  .post("/login-2fa", async ({ body: { session_id, password } }) => {
    const client = await getTelegramClient(session_id);
    const session = await getSession(session_id);
    if (!session) throw new ApiError(400, "Session not found");


    await client.signInWithPassword(
      {
        apiId: session!.api_id,
        apiHash: session!.api_hash,
      },
      {
        password: async () => password,
        onError: (e: any) => {
          if (e.message.includes("PASSWORD_HASH_INVALID")) {
            throw new ApiError(403, "Invalid password");
          }
          throw new ApiError(500, e.message);
        },
      },
    );

    const newSessionString = client.session.save() as unknown as string;
    const updates: any = {
      id: session_id,
      auth_state: "logged_in",
      session_string: newSessionString,
    };

    await createOrUpdateSession(updates);
    const deletedIds = await deleteOtherSessionsByPhone(
      session!.phone,
      session_id,
    );
    for (const id of deletedIds) {
      await removeTelegramClient(id);
    }

    refreshIndex(session_id).catch(console.error);

    return { status: "logged_in" };
  }, {
    body: t.Object({
      session_id: t.String(),
      password: t.String({ description: "2FA Password" }),
    }),
    detail: {
      summary: "Login with 2FA password",
      tags: ["Auth"],
    }
  })
  .post("/set-pin", async ({ body: { pin }, headers }) => {
    const sessionId = headers["x-session-id"]!;
    await createOrUpdateSession({ id: sessionId, pin });
    return { status: "pin_updated" };
  }, {
    headers: t.Object({
      "x-session-id": t.String(),
    }),
    body: t.Object({
      pin: t.String({ minLength: 4, description: "New quick-login PIN" }),
    }),
    detail: {
      summary: "Set quick-login PIN",
      tags: ["Auth"],
    }
  })
  .post("/logout", async ({ headers }) => {
    const sessionId = headers["x-session-id"]!;
    await logoutAndDestroySession(sessionId);
    return { status: "logged_out" };
  }, {
    headers: t.Object({
      "x-session-id": t.String(),
    }),
    detail: {
      summary: "Logout and destroy session",
      tags: ["Auth"],
    }
  })
  .get("/me", async ({ headers }) => {
    const sessionId = headers["x-session-id"]!;
    const client = await getTelegramClient(sessionId);
    const me = await client.getMe();
    return { user: me };
  }, {
    headers: t.Object({
      "x-session-id": t.String(),
    }),
    detail: {
      summary: "Get current user profile",
      tags: ["Auth"],
    }
  });
