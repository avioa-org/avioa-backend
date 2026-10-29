export type AiStage = 'prepare' | 'provider' | 'references' | 'persist';
export const aiProviderOptions = (_model: string) => ({});
export function describeAiFailure(error: unknown, stage: AiStage) {
  const status = (error as { status?: number })?.status;
  return {
    message:
      status === 429
        ? 'La IA alcanzó su límite. Intenta más tarde.'
        : 'No se pudo completar la lectura o redacción. Revisa la conexión de IA y vuelve a intentar.',
    code: 'AUXILIARY_AI_FAILURE',
    inputTokens: 0,
    outputTokens: 0,
    retryable: status === 429 || !status,
    diagnostic: { stage, status: status || null },
  };
}
