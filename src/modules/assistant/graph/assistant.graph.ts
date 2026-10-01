import { ChatOpenAI } from '@langchain/openai';
import { END, START, StateGraph } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';

import { AssistantState } from './assistant.state';
import { LeavesService } from 'src/modules/leaves/leaves.service';
import { createLeaveTools } from '../tools/leave.tool';

export function createAssistantGraph(
  leaveService: LeavesService,
  userId: string,
) {
  /**
   * 1. Creamos las tools disponibles
   *    para este usuario autenticado.
   */
  const tools = createLeaveTools(leaveService, userId);

  /**
   * 2. Creamos el modelo.
   */
  const model = new ChatOpenAI({
    model: 'gpt-5.6-luna',
  });

  /**
   * 3. Le enseñamos al modelo
   *    qué tools puede utilizar.
   */
  const modelWithTools = model.bindTools(tools);

  /**
   * 4. Nodo del agente.
   */
  async function agentNode(state: typeof AssistantState.State) {
    const response = await modelWithTools.invoke(state.messages);

    return {
      messages: [response],
    };
  }

  /**
   * 5. Nodo que ejecuta las tools.
   */
  const toolsNode = new ToolNode(tools);

  /**
   * 6. Decidimos si el agente quiere
   *    utilizar una tool o terminar.
   */
  function shouldContinue(state: typeof AssistantState.State) {
    const lastMessage = state.messages.at(-1);

    if (!lastMessage) {
      return END;
    }

    /**
     * AIMessage puede contener tool_calls.
     */
    if (
      'tool_calls' in lastMessage &&
      Array.isArray(lastMessage.tool_calls) &&
      lastMessage.tool_calls.length > 0
    ) {
      return 'tools';
    }

    return END;
  }

  /**
   * 7. Construimos el grafo.
   */
  return new StateGraph(AssistantState)
    .addNode('agent', agentNode)
    .addNode('tools', toolsNode)

    .addEdge(START, 'agent')

    .addConditionalEdges('agent', shouldContinue, {
      tools: 'tools',
      [END]: END,
    })

    .addEdge('tools', 'agent')

    .compile();
}
