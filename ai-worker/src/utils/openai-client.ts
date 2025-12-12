/**
 * OpenAI Client Utility
 */

import OpenAI from 'openai';
import { logger } from './logger';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';
const MINI_MODEL = process.env.OPENAI_MINI_MODEL || 'gpt-4-turbo-preview';
const TEMPERATURE = parseFloat(process.env.AI_TEMPERATURE || '0.7');
const MAX_TOKENS = parseInt(process.env.AI_MAX_TOKENS || '2000');

export interface AIRequest {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface AIResponse<T = any> {
  content: string;
  parsed?: T;
  tokensUsed: number;
  model: string;
  processingTime: number;
}

/**
 * Call OpenAI API with structured prompts
 */
export async function callAI<T = any>(request: AIRequest): Promise<AIResponse<T>> {
  const startTime = Date.now();
  
  try {
    const {
      prompt,
      systemPrompt = 'You are an AI assistant that provides structured analysis and recommendations.',
      model = DEFAULT_MODEL,
      temperature = TEMPERATURE,
      maxTokens = MAX_TOKENS,
      jsonMode = true,
    } = request;

    logger.debug('Calling OpenAI API', { model, temperature, jsonMode });

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature,
      max_tokens: maxTokens,
      response_format: jsonMode ? { type: 'json_object' } : { type: 'text' },
    });

    const content = completion.choices[0]?.message?.content || '';
    const tokensUsed = completion.usage?.total_tokens || 0;
    const processingTime = Date.now() - startTime;

    logger.info('AI response received', {
      model,
      tokensUsed,
      processingTime,
      contentLength: content.length,
    });

    let parsed: T | undefined;
    if (jsonMode) {
      try {
        parsed = JSON.parse(content);
      } catch (error) {
        logger.error('Failed to parse AI JSON response:', { content, error });
        throw new Error('AI returned invalid JSON');
      }
    }

    return {
      content,
      parsed,
      tokensUsed,
      model,
      processingTime,
    };
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    logger.error('OpenAI API error:', {
      error: error.message,
      processingTime,
    });
    throw error;
  }
}

/**
 * Call OpenAI with mini model for faster/cheaper operations
 */
export async function callAIMini<T = any>(request: Omit<AIRequest, 'model'>): Promise<AIResponse<T>> {
  return callAI<T>({ ...request, model: MINI_MODEL });
}

export default { callAI, callAIMini };

