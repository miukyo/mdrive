import { Router } from "express";
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

export const authRouter = Router();

authRouter.post("/send-code", async (req, res, next) => {
  try {
    const { phone, force_sms, pin } = req.body;
    if (!phone) {
      throw new ApiError(400, "phone is required");
    }

    if (!force_sms) {
      const existing = await getActiveSessionByPhone(phone);
      if (existing && existing.pin) {
        if (pin) {
          if (existing.pin === pin) {
            return res.json({ session_id: existing.id, status: "logged_in" });
          } else {
            throw new ApiError(403, "Invalid PIN");
          }
        }
        return res.json({ session_id: existing.id, status: "pin_required" });
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

    let sessionId = req.headers["x-session-id"] as string;
    if (!sessionId) {
      sessionId = crypto.randomUUID();
    }

    // Create session first without a client
    await createOrUpdateSession({
      id: sessionId,
      phone,
      api_id,
      api_hash,
      auth_state: "pending_code",
    });

    // Create a fresh client (not from cache) for the code request
    await removeTelegramClient(sessionId); // evict any stale cached client
    const client = await getTelegramClient(sessionId);

    const { phoneCodeHash } = await client.sendCode(
      {
        apiId: api_id,
        apiHash: api_hash,
      },
      phone,
    );

    // Save phone_code_hash into session immediately
    await createOrUpdateSession({
      id: sessionId,
      phone_code_hash: phoneCodeHash,
    });

    res.json({ session_id: sessionId, status: "code_sent" });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/sign-in", async (req, res, next) => {
  try {
    const { code } = req.body;
    const sessionId = req.headers["x-session-id"] as string;

    if (!code || !sessionId) {
      throw new ApiError(400, "code and x-session-id are required");
    }

    const session = await getSession(sessionId);
    if (!session || !session.phone_code_hash) {
      throw new ApiError(400, "Invalid session or missing phone_code_hash");
    }

    const client = await getTelegramClient(sessionId);

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
        id: sessionId,
        auth_state: "logged_in",
        session_string: newSessionString,
      };

      await createOrUpdateSession(updates);
      const deletedIds = await deleteOtherSessionsByPhone(
        session.phone,
        sessionId,
      );
      for (const id of deletedIds) {
        await removeTelegramClient(id);
      }
      // Trigger background index refresh after successful login
      refreshIndex(sessionId).catch(console.error);
      res.json({ status: "logged_in" });
    } catch (error: any) {
      if (error.message.includes("SESSION_PASSWORD_NEEDED")) {
        await createOrUpdateSession({
          id: sessionId,
          auth_state: "pending_password",
        });
        res.json({ status: "password_required" });
      } else {
        throw error;
      }
    }
  } catch (err) {
    next(err);
  }
});

authRouter.post("/check-password", async (req, res, next) => {
  try {
    const { password } = req.body;
    const sessionId = req.headers["x-session-id"] as string;

    if (!password || !sessionId) {
      throw new ApiError(400, "password and x-session-id are required");
    }

    const client = await getTelegramClient(sessionId);

    const session = await getSession(sessionId);
    // GramJS sign in with password
    await client.signInWithPassword(
      {
        apiId: session!.api_id,
        apiHash: session!.api_hash,
      },
      {
        password,
        onError: (e) => {
          throw e;
        },
      },
    );

    const newSessionString = client.session.save() as unknown as string;
    const updates: any = {
      id: sessionId,
      auth_state: "logged_in",
      session_string: newSessionString,
    };

    await createOrUpdateSession(updates);
    const deletedIds = await deleteOtherSessionsByPhone(
      session!.phone,
      sessionId,
    );
    for (const id of deletedIds) {
      await removeTelegramClient(id);
    }

    // Trigger background index refresh after successful password check
    refreshIndex(sessionId).catch(console.error);

    res.json({ status: "logged_in" });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/set-pin", async (req, res, next) => {
  try {
    const { pin } = req.body;
    const sessionId = req.headers["x-session-id"] as string;

    if (!pin || !sessionId) {
      throw new ApiError(400, "pin and x-session-id are required");
    }

    await createOrUpdateSession({ id: sessionId, pin });
    res.json({ status: "pin_updated" });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    const sessionId = req.headers["x-session-id"] as string;
    if (!sessionId) {
      throw new ApiError(400, "x-session-id is required");
    }

    await logoutAndDestroySession(sessionId);
    res.json({ status: "logged_out" });
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", async (req, res, next) => {
  try {
    const sessionId = req.headers["x-session-id"] as string;
    if (!sessionId) {
      throw new ApiError(401, "Unauthorized");
    }

    const client = await getTelegramClient(sessionId);
    const me = await client.getMe();

    res.json({ user: me });
  } catch (err) {
    next(err);
  }
});
