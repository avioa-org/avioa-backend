import { AIMessage, AIMessageChunk } from '@langchain/core/messages';

export function isAIChunk(msg: any): boolean {
  if (!msg) return false;
  if (msg instanceof AIMessage || msg instanceof AIMessageChunk) return true;

  const type = msg?._getType?.() ?? msg?.type;
  return type === 'ai' || type === 'AIMessageChunk';
}
