import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { getSession, deleteSession } from '../repositories/sessions.js';

const clients = new Map<string, TelegramClient>();

// --- Queue System ---
class RequestQueue {
  private queue: (() => Promise<any>)[] = [];
  private running = false;
  private lastRequestTime = 0;
  private minDelay = 200; // ms between requests

  async add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          // Rate limiting: Ensure min delay between requests
          const now = Date.now();
          const elapsed = now - this.lastRequestTime;
          if (elapsed < this.minDelay) {
            await new Promise(r => setTimeout(r, this.minDelay - elapsed));
          }
          
          this.lastRequestTime = Date.now();
          const result = await task();
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });
      this.process();
    });
  }

  private async process() {
    if (this.running || this.queue.length === 0) return;
    this.running = true;
    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) await task();
    }
    this.running = false;
  }
}

const queues = new Map<string, RequestQueue>();

const getQueue = (sessionId: string) => {
  let q = queues.get(sessionId);
  if (!q) {
    q = new RequestQueue();
    queues.set(sessionId, q);
  }
  return q;
};
// --------------------

export const getTelegramClient = async (sessionId: string, connect = true): Promise<TelegramClient> => {
  let client = clients.get(sessionId);

  if (client) {
    // If client exists but disconnected, try to reconnect
    if (connect && !client.connected) {
      try {
        console.log(`Reconnecting Telegram client for session: ${sessionId}`);
        await client.connect();
      } catch (e) {
        console.error(`Reconnection failed for ${sessionId}, purging client:`, e);
        clients.delete(sessionId);
        client = undefined;
      }
    }
  }

  // If still exists, double check connection health if it's supposed to be connected
  if (client && connect && client.connected) {
    try {
      // Very fast check to see if the socket is actually alive
      await Promise.race([
        client.invoke(new Api.help.GetConfig()),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Health check timeout')), 2000))
      ]);
    } catch (e) {
      console.warn(`Client for ${sessionId} failed health check, recreating...`);
      try { await client.disconnect(); } catch {}
      clients.delete(sessionId);
      client = undefined;
    }
  }

  if (client) {
    return client;
  }

  const dbSession = await getSession(sessionId);
  if (!dbSession) {
    throw new Error('Session not found');
  }

  console.log(`Creating fresh Telegram client for session: ${sessionId}`);
  const stringSession = new StringSession(dbSession.session_string || '');
  const newClient = new TelegramClient(stringSession, dbSession.api_id, dbSession.api_hash, {
    connectionRetries: 3,
    timeout: 10000, 
    autoReconnect: true,
    floodSleepThreshold: 60,
  });

  if (connect) {
    try {
      await newClient.connect();
    } catch (e) {
      console.error(`Initial connection failed for ${sessionId}:`, e);
      throw e;
    }
  }

  clients.set(sessionId, newClient);
  return newClient;
};

/**
 * Execute a Telegram request through a rate-limited queue
 */
export const invokeQueued = async <T extends Api.AnyRequest>(
  sessionId: string, 
  request: T
): Promise<T extends Api.AnyRequest ? any : any> => {
  const client = await getTelegramClient(sessionId);
  const queue = getQueue(sessionId);
  return await queue.add(() => client.invoke(request));
};

export const removeTelegramClient = async (sessionId: string) => {
  if (clients.has(sessionId)) {
    const client = clients.get(sessionId)!;
    try {
      await client.disconnect();
    } catch (e) {
      console.error('Error during disconnect:', e);
    }
    clients.delete(sessionId);
    queues.delete(sessionId);
  }
};

export const logoutAndDestroySession = async (sessionId: string) => {
  try {
    const client = await getTelegramClient(sessionId, false);
    await client.invoke(new Api.auth.LogOut());
  } catch (e) {
    console.error('Logout error:', e);
  } finally {
    await removeTelegramClient(sessionId);
    await deleteSession(sessionId);
  }
};
