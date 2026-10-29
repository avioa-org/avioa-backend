import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { z } from 'zod';
import { envs } from '../../config/env.config';

export type AuxiliaryAiContentPart =
  | { type: 'text'; text: string }
  | {
      type: 'file';
      data: Uint8Array;
      mediaType: string;
      filename?: string;
    };

export type AuxiliaryAiMessage = {
  role: 'user' | 'assistant';
  content: string | AuxiliaryAiContentPart[];
};

@Injectable()
export class AuxiliaryOpenAiService {
  private readonly client = new OpenAI({
    apiKey: envs.AUXILIARY_OPENAI_API_KEY || envs.OPENAI_API_KEY,
    maxRetries: 0,
  });

  async generateStructured<T>(options: {
    model: string;
    instructions: string;
    messages: AuxiliaryAiMessage[];
    schema: z.ZodType<T>;
    schemaName: string;
    maxOutputTokens: number;
    timeoutMs: number;
  }): Promise<{
    output: T;
    usage: { inputTokens: number; outputTokens: number };
  }> {
    const input = options.messages.map((message) => ({
      role: message.role,
      content:
        typeof message.content === 'string'
          ? message.content
          : message.content.map((part) => {
              if (part.type === 'text') {
                return { type: 'input_text', text: part.text };
              }

              const encoded = Buffer.from(part.data).toString('base64');
              if (part.mediaType.startsWith('image/')) {
                return {
                  type: 'input_image',
                  image_url: `data:${part.mediaType};base64,${encoded}`,
                  detail: 'high',
                };
              }

              return {
                type: 'input_file',
                filename: part.filename || 'documento.pdf',
                file_data: `data:${part.mediaType};base64,${encoded}`,
              };
            }),
    }));

    const response = await this.client.responses.create(
      {
        model: options.model,
        instructions: options.instructions,
        input,
        text: {
          format: {
            type: 'json_schema',
            name: options.schemaName,
            strict: true,
            schema: z.toJSONSchema(options.schema) as never,
          },
        },
        max_output_tokens: options.maxOutputTokens,
      } as never,
      { signal: AbortSignal.timeout(options.timeoutMs) },
    );

    if (response.status !== 'completed' || !response.output_text) {
      throw new Error('La IA no completó la respuesta.');
    }

    return {
      output: options.schema.parse(JSON.parse(response.output_text)),
      usage: {
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
      },
    };
  }
}
