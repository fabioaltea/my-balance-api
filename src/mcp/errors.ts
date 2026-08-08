import { GoogleTokenError } from '../helpers/google';

export class McpApplicationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'McpApplicationError';
  }
}

export function resourceNotFound(resource: string): McpApplicationError {
  return new McpApplicationError('RESOURCE_NOT_FOUND', `${resource} not found`);
}

export function toMcpErrorResult(error: unknown) {
  let code = 'INTERNAL_ERROR';
  let message = 'The operation could not be completed';
  let requiresReauth = false;

  if (error instanceof GoogleTokenError) {
    code = error.code;
    message = error.message;
    requiresReauth = true;
  } else if (error instanceof McpApplicationError) {
    code = error.code;
    message = error.message;
  }

  const structuredContent = {
    error: {
      code,
      message,
      requiresReauth,
    },
  };

  return {
    isError: true as const,
    content: [{ type: 'text' as const, text: JSON.stringify(structuredContent) }],
    structuredContent,
  };
}
