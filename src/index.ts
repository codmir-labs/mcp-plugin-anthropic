import { randomUUID } from "crypto";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createPrismaClient, type PrismaClient } from "@codmir/database";
import type { PrismaLike } from "@codmir/auth/validate";
import { createAuthMiddleware } from "./auth.js";
import { CONNECTOR_TOOLS, executeTool } from "./tools/index.js";

const PORT = Number(process.env.PORT) || 3304;
const SESSION_TTL_MS = 30 * 60 * 1000;

interface Session {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
  lastActivity: number;
}

const sessions = new Map<string, Session>();

function createMcpServer(prisma: PrismaClient, userId: string): McpServer {
  const server = new McpServer(
    {
      name: "codmir",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: CONNECTOR_TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const result = await executeTool(
      name,
      (args || {}) as Record<string, unknown>,
      userId,
      prisma
    );
    return result as any;
  });

  return server;
}

async function main() {
  const prisma = createPrismaClient();
  const app = express();
  const authMiddleware = createAuthMiddleware(
    prisma as unknown as PrismaLike
  );

  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "mcp-connector-anthropic",
      version: "0.1.0",
      port: PORT,
      activeSessions: sessions.size,
      tools: CONNECTOR_TOOLS.length,
    });
  });

  app.post("/mcp", authMiddleware, async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    const userId = req.userId!;

    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId)!;
      session.lastActivity = Date.now();
      await session.transport.handleRequest(req, res, req.body);
      return;
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });

    const server = createMcpServer(prisma, userId);
    await server.server.connect(transport);
    await transport.handleRequest(req, res, req.body);

    const newSessionId = transport.sessionId;
    if (newSessionId && !sessions.has(newSessionId)) {
      sessions.set(newSessionId, {
        transport,
        server,
        lastActivity: Date.now(),
      });
    }
  });

  app.get("/mcp", authMiddleware, async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !sessions.has(sessionId)) {
      res.status(400).json({ error: "Invalid or missing session" });
      return;
    }
    const session = sessions.get(sessionId)!;
    session.lastActivity = Date.now();
    await session.transport.handleRequest(req, res);
  });

  app.delete("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId)!;
      await session.transport.handleRequest(req, res);
      sessions.delete(sessionId);
      return;
    }
    res.status(204).end();
  });

  setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (now - session.lastActivity > SESSION_TTL_MS) {
        session.server.server.close().catch(() => {});
        sessions.delete(id);
      }
    }
  }, 5 * 60 * 1000);

  app.listen(PORT, () => {
    console.log(`Codmir MCP Connector (Anthropic) running on port ${PORT}`);
    console.log(`Tools: ${CONNECTOR_TOOLS.map((t) => t.name).join(", ")}`);
  });
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
