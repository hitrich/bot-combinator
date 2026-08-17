import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createBotCombinatorMcpServer } from './server.js';
import type { BotCombinatorMcpServerOptions, BotCombinatorMcpService } from './types.js';

export interface RunningBotCombinatorStdioServer {
  close: () => Promise<void>;
}

/**
 * Connect an injected Bot Combinator service to MCP over the process stdio streams.
 * The host owns process lifecycle and must call `close` during shutdown.
 *
 * No standalone adapter loader is provided intentionally: accepting a module
 * path or database path from environment variables would enlarge the security
 * boundary and undermine service injection.
 */
export async function serveBotCombinatorMcpOverStdio(
  service: BotCombinatorMcpService,
  options: BotCombinatorMcpServerOptions = {},
): Promise<RunningBotCombinatorStdioServer> {
  const server = createBotCombinatorMcpServer(service, options);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  return {
    close: async () => {
      await server.close();
    },
  };
}
