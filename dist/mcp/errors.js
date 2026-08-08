"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpApplicationError = void 0;
exports.resourceNotFound = resourceNotFound;
exports.toMcpErrorResult = toMcpErrorResult;
const google_1 = require("../helpers/google");
class McpApplicationError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'McpApplicationError';
    }
}
exports.McpApplicationError = McpApplicationError;
function resourceNotFound(resource) {
    return new McpApplicationError('RESOURCE_NOT_FOUND', `${resource} not found`);
}
function toMcpErrorResult(error) {
    let code = 'INTERNAL_ERROR';
    let message = 'The operation could not be completed';
    let requiresReauth = false;
    if (error instanceof google_1.GoogleTokenError) {
        code = error.code;
        message = error.message;
        requiresReauth = true;
    }
    else if (error instanceof McpApplicationError) {
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
        isError: true,
        content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
        structuredContent,
    };
}
//# sourceMappingURL=errors.js.map