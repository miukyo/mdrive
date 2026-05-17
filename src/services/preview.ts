import { Api } from 'telegram';
import { getTelegramClient } from './telegram.js';

export const getMessageMedia = async (sessionId: string, folderId: number | null, messageId: number) => {
  const client = await getTelegramClient(sessionId);
  let peer: Api.TypeInputPeer;
  if (folderId) {
    peer = await client.getInputEntity(folderId);
  } else {
    peer = await client.getInputEntity('me');
  }

  const messages = await client.getMessages(peer, { ids: messageId });
  if (!messages || messages.length === 0 || !messages[0]) {
    throw new Error('Message not found');
  }

  const msg = messages[0];
  if (!msg.media) {
    throw new Error('Message has no media');
  }

  return { client, media: msg.media };
};
