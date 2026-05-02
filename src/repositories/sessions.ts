import { sqlite } from '../db.js';

export interface TelegramSession {
  id: string;
  phone: string;
  api_id: number;
  api_hash: string;
  session_string: string;
  phone_code_hash: string | null;
  auth_state: string;
  pin: string | null;
  created_at: Date;
  updated_at: Date;
  last_active_at: Date | null;
}

export const getSession = async (id: string): Promise<TelegramSession | null> => {
  const row = sqlite.query('SELECT * FROM telegram_sessions WHERE id = ?').get(id) as TelegramSession | undefined;
  return row || null;
};

export const getActiveSessionByPhone = async (phone: string): Promise<TelegramSession | null> => {
  const row = sqlite.query(
    "SELECT * FROM telegram_sessions WHERE phone = ? AND auth_state = 'logged_in'"
  ).get(phone) as TelegramSession | undefined;
  return row || null;
};

export const createOrUpdateSession = async (session: Partial<TelegramSession> & { id: string }) => {
  const existing = await getSession(session.id);

  if (existing) {
    // Build a partial UPDATE — only touch the fields explicitly passed in
    const updates = Object.keys(session).filter(k => k !== 'id');
    if (updates.length === 0) return;

    const setClause = updates.map(k => `${k} = ?`).join(', ');
    const values = updates.map(k => (session as any)[k]);

    sqlite.query(
      `UPDATE telegram_sessions SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(...values, session.id);
  } else {
    // Full INSERT for a brand new session
    sqlite.query(
      `INSERT INTO telegram_sessions (id, phone, api_id, api_hash, auth_state, phone_code_hash, session_string, pin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      session.id,
      session.phone ?? null,
      session.api_id ?? null,
      session.api_hash ?? null,
      session.auth_state ?? 'logged_out',
      session.phone_code_hash ?? null,
      session.session_string ?? '',
      session.pin ?? null
    );
  }
};

export const deleteSession = async (id: string) => {
  sqlite.query('DELETE FROM telegram_sessions WHERE id = ?').run(id);
};

export const deleteOtherSessionsByPhone = async (phone: string, currentSessionId: string): Promise<string[]> => {
  const sessions = sqlite.query('SELECT id FROM telegram_sessions WHERE phone = ? AND id != ?').all(phone, currentSessionId) as {id: string}[];
  const ids = sessions.map(s => s.id);
  
  if (ids.length > 0) {
    const placeholders = ids.map(() => '?').join(',');
    sqlite.query(`DELETE FROM telegram_sessions WHERE id IN (${placeholders})`).run(...ids);
  }
  return ids;
};
