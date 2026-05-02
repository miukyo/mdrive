import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { getSession, createOrUpdateSession, deleteSession } from '../repositories/sessions.js';

const clients = new Map<string, TelegramClient>();

export const getTelegramClient = async (sessionId: string, connect = true): Promise<TelegramClient> => {
  if (clients.has(sessionId)) {
    return clients.get(sessionId)!;
  }

  const dbSession = await getSession(sessionId);
  if (!dbSession) {
    throw new Error('Session not found');
  }

  const stringSession = new StringSession(dbSession.session_string || '');
  const client = new TelegramClient(stringSession, dbSession.api_id, dbSession.api_hash, {
    connectionRetries: 10,
    timeout: 30000, // 30 seconds
  });

  if (connect) {
    await client.connect();
  }

  clients.set(sessionId, client);
  return client;
};

export const removeTelegramClient = async (sessionId: string) => {
  if (clients.has(sessionId)) {
    const client = clients.get(sessionId)!;
    await client.disconnect();
    clients.delete(sessionId);
  }
};

export const logoutAndDestroySession = async (sessionId: string) => {
  try {
    const client = await getTelegramClient(sessionId, false);
    await client.invoke(new (require('telegram/tl/api.js').Api.auth.LogOut)());
  } catch (e) {
    console.error('Logout error:', e);
  } finally {
    await removeTelegramClient(sessionId);
    await deleteSession(sessionId);
  }
};
