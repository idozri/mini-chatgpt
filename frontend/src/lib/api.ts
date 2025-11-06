// API client with timeout handling and abort controller support

import axios, { AxiosError, CancelTokenSource } from 'axios';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  lastMessageAt: string | null;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  isError?: boolean; // Reason: Flag to indicate error messages that can be retried
  errorMessage?: string; // Reason: The original error message text
  failedUserMessageId?: string; // Reason: Reference to the user message that failed, for retry
}

export interface ConversationWithMessages extends Conversation {
  messages: {
    items: Message[];
    nextCursor: string | null;
    prevCursor: string | null;
    hasMore: boolean;
  };
}

export interface SendMessageResponse {
  message: Message;
  reply: Message;
}

export interface ApiError {
  error: string;
  retryAfterMs?: number;
  details?: unknown;
  messageId?: string; // Reason: For LLM errors - indicates the user message was already saved
}

// Reason: Create axios instance with default timeout of 12 seconds
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 12000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Reason: Custom error class to carry additional error information
export class ApiRequestError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public messageId?: string,
    public isLlmError?: boolean
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

// Reason: Handle errors consistently
function handleError(error: unknown): never {
  if (axios.isCancel(error)) {
    throw new ApiRequestError('Request cancelled');
  }

  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiError>;

    if (axiosError.code === 'ECONNABORTED') {
      throw new ApiRequestError(
        'Request timeout - the server took too long to respond'
      );
    }

    if (axiosError.response) {
      const { status, data } = axiosError.response;

      if (status === 499) {
        throw new ApiRequestError('Request cancelled', 499);
      }

      const errorMessage =
        data?.error || `HTTP ${status}: ${axiosError.response.statusText}`;

      // Reason: 502 indicates LLM error - message was saved, just need to retry LLM
      const isLlmError = status === 502;
      throw new ApiRequestError(
        errorMessage,
        status,
        data?.messageId,
        isLlmError
      );
    }

    if (axiosError.request) {
      throw new ApiRequestError('Network error - unable to reach the server');
    }
  }

  throw error instanceof Error
    ? error
    : new ApiRequestError('An unknown error occurred');
}

export const api = {
  // Conversations
  async listConversations(): Promise<Conversation[]> {
    try {
      const response = await axiosInstance.get<Conversation[]>(
        '/conversations'
      );
      return response.data;
    } catch (error) {
      throw handleError(error);
    }
  },

  async createConversation(): Promise<Conversation> {
    // Reason: Backend auto-generates title as "Conversation #<displayIndex>"
    // No title needed in request body
    try {
      const response = await axiosInstance.post<Conversation>(
        '/conversations',
        {}
      );
      return response.data;
    } catch (error) {
      throw handleError(error);
    }
  },

  async getConversation(
    id: string,
    cursor?: string,
    limit: number = 20
  ): Promise<ConversationWithMessages> {
    try {
      const params: Record<string, string> = {
        limit: limit.toString(),
        cursor,
      };

      const response = await axiosInstance.get<ConversationWithMessages>(
        `/conversations/${id}`,
        { params }
      );
      return response.data;
    } catch (error) {
      throw handleError(error);
    }
  },

  async updateConversation(id: string, title: string): Promise<Conversation> {
    try {
      const response = await axiosInstance.patch<Conversation>(
        `/conversations/${id}`,
        { title }
      );
      return response.data;
    } catch (error) {
      throw handleError(error);
    }
  },

  async deleteConversation(id: string): Promise<void> {
    try {
      await axiosInstance.delete(`/conversations/${id}`);
    } catch (error) {
      throw handleError(error);
    }
  },

  // Messages
  async sendMessage(
    conversationId: string,
    content: string,
    abortSignal?: AbortSignal,
    existingMessageId?: string // Reason: For retries - reuse existing message if provided
  ): Promise<SendMessageResponse> {
    // Reason: Create CancelToken for axios cancellation
    const cancelTokenSource = axios.CancelToken.source();

    // Reason: Combine external abort signal with axios cancel token
    if (abortSignal) {
      abortSignal.addEventListener('abort', () => {
        cancelTokenSource.cancel('Request cancelled');
      });
    }

    try {
      const response = await axiosInstance.post<SendMessageResponse>(
        `/conversations/${conversationId}/messages`,
        {
          content,
          ...(existingMessageId && { existingMessageId }), // Reason: Only include if provided
        },
        {
          cancelToken: cancelTokenSource.token,
        }
      );
      return response.data;
    } catch (error) {
      throw handleError(error);
    }
  },
};
