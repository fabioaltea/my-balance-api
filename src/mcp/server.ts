import { createMcpHandler, McpServer, type McpRequestContext } from '@modelcontextprotocol/server';
import { getMcpPrincipal } from './context';
import { registerReadTools } from './tools/read.tools';

export function createMyBalanceMcpServer(context: McpRequestContext): McpServer {
  const server = new McpServer({
    name: 'mybalance-api',
    version: '1.0.0',
  });

  registerReadTools(server, getMcpPrincipal(context.authInfo));
  return server;
}

export const myBalanceMcpHandler = createMcpHandler(createMyBalanceMcpServer, {
  legacy: 'reject',
  responseMode: 'json',
  onerror: (error) => {
    console.error(`[MCP] Protocol error: ${error.message}`);
  },
});
