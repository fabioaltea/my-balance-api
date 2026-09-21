"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.myBalanceMcpHandler = void 0;
exports.createMyBalanceMcpServer = createMyBalanceMcpServer;
const server_1 = require("@modelcontextprotocol/server");
const context_1 = require("./context");
const read_tools_1 = require("./tools/read.tools");
function createMyBalanceMcpServer(context) {
    const server = new server_1.McpServer({
        name: 'mybalance-api',
        version: '1.0.0',
    });
    (0, read_tools_1.registerReadTools)(server, (0, context_1.getMcpPrincipal)(context.authInfo));
    return server;
}
exports.myBalanceMcpHandler = (0, server_1.createMcpHandler)(createMyBalanceMcpServer, {
    legacy: 'reject',
    responseMode: 'json',
    onerror: (error) => {
        console.error(`[MCP] Protocol error: ${error.message}`);
    },
});
//# sourceMappingURL=server.js.map