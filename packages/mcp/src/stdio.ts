import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createOutreachrMcpServer } from './server.js';
import type { OutreachrMcpServerOptions, OutreachrMcpService } from './types.js';

export interface RunningOutreachrStdioServer {
  close: () => Promise<void>;
}

/**
 * Connect an injected Outreachr service to MCP over the process stdio streams.
 * The host owns process lifecycle and must call `close` during shutdown.
 *
 * No standalone adapter loader is provided intentionally: accepting a module
 * path or database path from environment variables would enlarge the security
 * boundary and undermine service injection.
 */
export async function serveOutreachrMcpOverStdio(
  service: OutreachrMcpService,
  options: OutreachrMcpServerOptions = {},
): Promise<RunningOutreachrStdioServer> {
  const server = createOutreachrMcpServer(service, options);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  return {
    close: async () => {
      await server.close();
    },
  };
}
