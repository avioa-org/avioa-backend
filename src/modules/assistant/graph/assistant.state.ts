import { BaseMessage } from '@langchain/core/messages';
import { Annotation } from '@langchain/langgraph';

// STATE
// |------ messages
export const AssistantState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
  userId: Annotation<string>,
  role: Annotation<string>,
  isLeader: Annotation<boolean>,
});
