import { getRuntime } from '../runtime';
import { auxJson } from '../domain/auxiliary';
import { readSacAiConfig } from '../domain/sac-ai-settings';
export async function GET() {
  const r = getRuntime(),
    c = await readSacAiConfig(r.DB);
  return auxJson({
    permissions: { edit: r.canWrite, name: r.name },
    aiEnabled: !!c?.enabled,
    model: c?.model || '',
  });
}
