import { ChatOpenAI } from '@langchain/openai';
import { END, START, StateGraph } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';

import { AssistantState } from './assistant.state';
import { LeavesService } from 'src/modules/leaves/leaves.service';
import { createLeaveTools } from '../tools/leave.tool';
import { SystemMessage } from '@langchain/core/messages';

export function createAssistantGraph(
  leaveService: LeavesService,
  userId: string,
  role: string,
  isLeader: boolean,
) {
  const tools = createLeaveTools(leaveService, userId, isLeader);

  const model = new ChatOpenAI({
    model: 'gpt-5.6-luna',
    streaming: true,
  });

  const modelWithTools = model.bindTools(tools);

  async function agentNode(state: typeof AssistantState.State) {
    const systemPrompt =
      new SystemMessage(`Eres un asistente del portal empresarial de aVioa especializado en vacaciones y permisos.

Usuario actual:
- userId: ${userId}
- Rol: ${role}
- Es líder: ${isLeader ? 'Sí' : 'No'}

Reglas:
1. Empleado → solo puede ver y gestionar SUS propias vacaciones.
2. Líder → puede consultar además las vacaciones de su equipo.
3. Nunca inventes datos. Siempre usa las tools.
4. Fechas siempre en formato YYYY-MM-DD.
5. Responde en español, claro y profesional.
6. Cuando muestres saldos, explica brevemente los números (accrued, taken, pending, available, projectedAvailable).
7. Si el usuario pide crear una solicitud y faltan datos, pregunta antes de llamar a la tool.`);

    const response = await modelWithTools.invoke([
      systemPrompt,
      ...state.messages,
    ]);

    return { messages: [response] };
  }

  const toolsNode = new ToolNode(tools);

  function shouldContinue(state: typeof AssistantState.State) {
    const lastMessage = state.messages.at(-1);

    if (
      lastMessage &&
      'tool_calls' in lastMessage &&
      Array.isArray((lastMessage as any).tool_calls) &&
      (lastMessage as any).tool_calls.length > 0
    ) {
      return 'tools';
    }

    return END;
  }

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
