import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createServer } from './server.js';

// MCP uses stdout for JSON-RPC. All diagnostics must go to stderr.
void serveStdio(createServer);
console.error('LocalBridge MCP server 0.1.0 iniciado; esperando conexión segura de ChatGPT.');
