/**
 * Centralized error handling for CompressX
 * Converts API errors to user-friendly messages
 */

export interface APIError {
  status: number;
  message: string;
  isRetryable: boolean;
  userMessage: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  status?: number;
}

/**
 * Parse API error response and return user-friendly message
 */
export function parseAPIError(
  status: number,
  errorMessage?: string,
  context?: string
): APIError {
  // Normalize status
  const normalizedStatus = status || 500;

  // Check for specific error patterns
  if (errorMessage) {
    const lower = errorMessage.toLowerCase();

    // Quota exceeded
    if (lower.includes('quota') || lower.includes('rate limit')) {
      return {
        status: 429,
        message: errorMessage,
        isRetryable: false,
        userMessage: '🔄 Daily limit reached. Please try again tomorrow or use a different file.',
      };
    }

    // Timeout
    if (lower.includes('timeout') || lower.includes('abort')) {
      return {
        status: 408,
        message: errorMessage,
        isRetryable: true,
        userMessage: '⏱️ Request took too long. Please try again with a smaller file.',
      };
    }

    // Service unavailable
    if (lower.includes('unavailable') || lower.includes('busy')) {
      return {
        status: 503,
        message: errorMessage,
        isRetryable: true,
        userMessage: '🤖 AI is busy right now. Please try again in a moment.',
      };
    }

    // File issues
    if (lower.includes('password') || lower.includes('encrypted')) {
      return {
        status: 422,
        message: errorMessage,
        isRetryable: false,
        userMessage: '🔒 This PDF is password-protected. Please remove the password and try again.',
      };
    }

    if (lower.includes('image') || lower.includes('scan')) {
      return {
        status: 422,
        message: errorMessage,
        isRetryable: false,
        userMessage: '📄 This appears to be a scanned image. Please use a text-based PDF.',
      };
    }

    if (lower.includes('empty') || lower.includes('no text')) {
      return {
        status: 422,
        message: errorMessage,
        isRetryable: false,
        userMessage: '📭 This PDF has no readable text. Please try a different file.',
      };
    }
  }

  // Handle by HTTP status code
  switch (normalizedStatus) {
    case 400:
      return {
        status: 400,
        message: errorMessage || 'Bad request',
        isRetryable: false,
        userMessage: '❌ Invalid request. Please check your file and try again.',
      };

    case 408:
    case 504:
      return {
        status: normalizedStatus,
        message: errorMessage || 'Request timeout',
        isRetryable: true,
        userMessage: '⏱️ Request took too long. Please try again with a smaller file.',
      };

    case 413:
      return {
        status: 413,
        message: errorMessage || 'File too large',
        isRetryable: false,
        userMessage: '📦 File is too large. Maximum size is 5MB.',
      };

    case 415:
      return {
        status: 415,
        message: errorMessage || 'Unsupported file type',
        isRetryable: false,
        userMessage: '📋 Only PDF files are supported.',
      };

    case 422:
      return {
        status: 422,
        message: errorMessage || 'Unprocessable entity',
        isRetryable: false,
        userMessage: '⚠️ Unable to process this file. Please try a different PDF.',
      };

    case 429:
      return {
        status: 429,
        message: errorMessage || 'Rate limit exceeded',
        isRetryable: false,
        userMessage: '🔄 Daily limit reached. Please try again tomorrow.',
      };

    case 500:
    case 502:
    case 503:
    case 504:
      return {
        status: normalizedStatus,
        message: errorMessage || 'Server error',
        isRetryable: true,
        userMessage: '🤖 AI service is temporarily unavailable. Please try again in a moment.',
      };

    default:
      return {
        status: normalizedStatus,
        message: errorMessage || 'Unknown error',
        isRetryable: normalizedStatus >= 500,
        userMessage: '❌ Something went wrong. Please try again.',
      };
  }
}

/**
 * Handle fetch errors (network, timeout, etc.)
 */
export function handleFetchError(error: Error): APIError {
  const message = error.message.toLowerCase();

  if (message.includes('abort') || message.includes('timeout')) {
    return {
      status: 408,
      message: error.message,
      isRetryable: true,
      userMessage: '⏱️ Request took too long. Please try again with a smaller file.',
    };
  }

  if (message.includes('network') || message.includes('fetch')) {
    return {
      status: 0,
      message: error.message,
      isRetryable: true,
      userMessage: '🌐 Network error. Please check your connection and try again.',
    };
  }

  return {
    status: 0,
    message: error.message,
    isRetryable: true,
    userMessage: '❌ Connection error. Please try again.',
  };
}

/**
 * Check if error is critical (should delay install prompt)
 */
export function isCriticalError(status: number): boolean {
  return status === 503 || status === 502 || status === 500;
}

/**
 * Format error for logging
 */
export function formatErrorLog(error: APIError, context?: string): string {
  return `[${context || 'Error'}] Status: ${error.status}, Message: ${error.message}`;
}
