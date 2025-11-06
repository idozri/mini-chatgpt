import axios, { AxiosInstance, AxiosError } from 'axios';
import axiosRetry from 'axios-retry';
import { logger } from './logger';

export interface LlmMessage {
  role: string;
  content: string;
}

export interface LlmCompletionRequest {
  messages: LlmMessage[];
  abortSignal?: AbortSignal;
}

export interface LlmCompletionResponse {
  completion: string;
}

export interface LlmAdapter {
  complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse>;
}

// Reason: Create axios client with 12s timeout and retry configuration
// Retries up to 2 times with exponential backoff (500ms, 1000ms)
function createHttpClient(): AxiosInstance {
  const client = axios.create({
    timeout: 12000, // 12s timeout
    headers: {
      'Content-Type': 'application/json',
    },
  });

  axiosRetry(client, {
    retries: 2,
    retryDelay: (retryCount: number) => {
      // Reason: Exponential backoff: 500ms for first retry, 1000ms for second
      const delayMs = 500 * Math.pow(2, retryCount - 1);
      return delayMs;
    },
    retryCondition: (error: AxiosError) => {
      // Reason: Retry on network errors (no response) or 5xx server errors
      return !error.response || error.response.status >= 500;
    },
    onRetry: (retryCount: number, error: AxiosError) => {
      const url = error.config?.url || 'unknown';
      const delayMs = 500 * Math.pow(2, retryCount - 1);
      logger.warn(
        {
          attempt: retryCount,
          maxRetries: 2,
          delayMs,
          url,
          status: error.response?.status,
        },
        'LLM request failed, retrying...'
      );
    },
  });

  return client;
}

class MockLlmAdapter implements LlmAdapter {
  private baseUrl: string;
  private client: AxiosInstance;

  constructor() {
    const url = process.env.MOCK_LLM_BASE_URL;
    if (!url) {
      throw new Error('MOCK_LLM_BASE_URL environment variable is required');
    }
    this.baseUrl = url;
    this.client = createHttpClient();
  }

  async complete(
    request: LlmCompletionRequest
  ): Promise<LlmCompletionResponse> {
    const url = `${this.baseUrl}/complete`;
    const messages = request.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    logger.debug({ url, messageCount: messages.length }, 'Calling mock LLM');

    try {
      const response = await this.client.post(
        url,
        { messages },
        {
          signal: request.abortSignal,
        }
      );

      return { completion: response.data.completion || '' };
    } catch (error) {
      if (
        axios.isCancel(error) ||
        (error instanceof Error && error.message.includes('aborted'))
      ) {
        throw new Error('Request aborted');
      }
      throw error;
    }
  }
}

class OllamaLlmAdapter implements LlmAdapter {
  private baseUrl: string;
  private model: string;
  private client: AxiosInstance;

  constructor() {
    const url = process.env.OLLAMA_BASE_URL;
    const model = process.env.OLLAMA_MODEL;

    if (!url) {
      throw new Error('OLLAMA_BASE_URL environment variable is required');
    }
    if (!model) {
      throw new Error('OLLAMA_MODEL environment variable is required');
    }

    this.baseUrl = url;
    this.model = model;
    this.client = createHttpClient();
  }

  private async tryModel(
    model: string,
    prompt: string,
    abortSignal?: AbortSignal
  ): Promise<LlmCompletionResponse> {
    const url = `${this.baseUrl}/api/generate`;

    logger.debug({ url, model, promptLength: prompt.length }, 'Calling Ollama');

    const response = await this.client.post(
      url,
      {
        model,
        prompt,
        stream: false,
      },
      {
        signal: abortSignal,
      }
    );

    return { completion: response.data.response || '' };
  }

  async complete(
    request: LlmCompletionRequest
  ): Promise<LlmCompletionResponse> {
    const prompt = request.messages
      .map(
        (msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
      )
      .join('\n\n');

    try {
      return await this.tryModel(this.model, prompt, request.abortSignal);
    } catch (error) {
      logger.error(
        {
          model: this.model,
          error: (error as AxiosError<{ error: string }>).response?.data?.error,
        },
        'Ollama completion failed'
      );

      if (
        axios.isCancel(error) ||
        (error instanceof Error && error.message.includes('aborted'))
      ) {
        throw new Error('Request aborted');
      }
      throw error;
    }
  }
}

export function createLlmAdapter(): LlmAdapter {
  const provider = process.env.LLM_PROVIDER || 'mock';

  switch (provider) {
    case 'mock':
      return new MockLlmAdapter();
    case 'ollama':
      return new OllamaLlmAdapter();
    default:
      throw new Error(
        `Unknown LLM provider: ${provider}. Must be 'mock' or 'ollama'`
      );
  }
}
