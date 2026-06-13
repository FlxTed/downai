import type { ChatMessage } from '../store/chatStore';

export type ChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface ApiChatMessage {
  role: string;
  content: string | ChatContentPart[];
}

export function toApiMessage(message: Pick<ChatMessage, 'role' | 'content' | 'images'>): ApiChatMessage {
  if (!message.images?.length) {
    return { role: message.role, content: message.content };
  }
  const parts: ChatContentPart[] = [];
  if (message.content.trim()) {
    parts.push({ type: 'text', text: message.content });
  }
  for (const url of message.images) {
    parts.push({ type: 'image_url', image_url: { url } });
  }
  return { role: message.role, content: parts };
}
