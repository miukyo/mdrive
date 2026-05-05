export interface ProgressClient {
  write: (data: string) => void;
}

const clients = new Map<string, ProgressClient[]>();

export const addProgressClient = (sessionId: string, res: ProgressClient) => {
  if (!clients.has(sessionId)) {
    clients.set(sessionId, []);
  }
  clients.get(sessionId)!.push(res);
};

export const removeProgressClient = (sessionId: string, res: ProgressClient) => {
  if (clients.has(sessionId)) {
    const list = clients.get(sessionId)!;
    const idx = list.indexOf(res);
    if (idx !== -1) {
      list.splice(idx, 1);
    }
    if (list.length === 0) {
      clients.delete(sessionId);
    }
  }
};

export const emitProgress = (sessionId: string, event: string, data: any) => {
  if (clients.has(sessionId)) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of clients.get(sessionId)!) {
      res.write(payload);
    }
  }
};
