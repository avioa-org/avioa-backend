import { Injectable } from '@nestjs/common';
import { LeavesService } from '../leaves/leaves.service';
import { createAssistantGraph } from './graph/assistant.graph';
import { HumanMessage } from '@langchain/core/messages';

@Injectable()
export class AssistantService {
  constructor(private readonly leaveService: LeavesService) {}

  async chat(userId: string, message: string) {
    const graph = createAssistantGraph(this.leaveService, userId);

    const result = await graph.invoke({
      messages: [new HumanMessage(message)],
    });

    const lastMessage = result.messages.at(-1)!;

    return {
      message: lastMessage.content ?? '',
    };
  }
}
