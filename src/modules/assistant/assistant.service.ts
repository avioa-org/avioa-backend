import { Injectable } from '@nestjs/common';
import { LeavesService } from '../leaves/leaves.service';
import { createAssistantGraph } from './graph/assistant.graph';
import { HumanMessage } from '@langchain/core/messages';
import { Response } from 'express';
import { isAIChunk } from './utils/is-ai-chunk';
import { extractText } from './utils/extract-text';

@Injectable()
export class AssistantService {
  constructor(private readonly leaveService: LeavesService) {}

  async chatStream(
    userId: string,
    role: string,
    isLeader: boolean,
    message: string,
    res: Response,
  ) {
    const graph = createAssistantGraph(
      this.leaveService,
      userId,
      role,
      isLeader,
    );

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      const stream = await graph.stream(
        {
          messages: [new HumanMessage(message)],
          userId,
          role,
          isLeader,
        },
        {
          streamMode: 'messages',
        },
      );

      for await (const chunk of stream) {
        if (Array.isArray(chunk)) {
          const [msg] = chunk;

          if (!isAIChunk(msg)) continue;

          const text = extractText(msg.content);

          if (text) {
            res.write(
              `data: ${JSON.stringify({ type: 'token', content: text })}\n\n`,
            );
          }
        } else if ((chunk as any)?.agent?.messages) {
          const last = (chunk as any).agent.messages.at(-1);
          const text = extractText(last?.content);
          if (text) {
            res.write(
              `data: ${JSON.stringify({ type: 'token', content: text })}\n\n`,
            );
          }
        }
      }

      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();
    } catch (error) {
      res.write(
        `data: ${JSON.stringify({ type: 'error', message: (error as Error).message })}\n\n`,
      );
      res.end();
    }
  }

  async chat(userId: string, role: string, isLeader: boolean, message: string) {
    const graph = createAssistantGraph(
      this.leaveService,
      userId,
      role,
      isLeader,
    );

    const result = await graph.invoke({
      messages: [new HumanMessage(message)],
      userId,
      role,
      isLeader,
    });

    const lastMessage = result.messages.at(-1);
    return {
      response:
        typeof lastMessage?.content === 'string'
          ? lastMessage.content
          : JSON.stringify(lastMessage?.content),
    };
  }
}
