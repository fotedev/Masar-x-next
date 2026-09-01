import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { logger } from "@/lib/logger";

// Round-B security fix (subagent_01 gap 10): bearer auth + scoped CORS.
let mcpSecretWarned = false;

function getAllowedOrigin(request: Request): string {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  // Same-origin echo: only reflect an Origin whose host matches the request.
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host === new URL(request.url).host) return origin;
    } catch {
      // ignore malformed origin header
    }
  }
  return new URL(request.url).origin;
}

function isAuthorized(request: Request): boolean {
  const secret = process.env.VERCEL_MCP_BYPASS_SECRET;
  if (!secret) {
    if (!mcpSecretWarned) {
      mcpSecretWarned = true;
      logger.warn(
        "[api/mcp] VERCEL_MCP_BYPASS_SECRET is not set; /api/mcp is unauthenticated (acceptable for local dev only).",
      );
    }
    return true;
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

// Initialize MCP Server
const server = new McpServer({
  name: "masarx-mcp-server",
  version: "1.0.0",
});

// Register a sample tool to verify monitoring
server.tool(
  "get_project_info",
  "Get information about the Masar X project",
  {
    topic: z.string().describe("The topic to get info about (e.g., tech-stack, version)"),
  },
  async ({ topic }) => {
    if (topic === "tech-stack") {
      return {
        content: [{ type: "text", text: "Next.js 16, Supabase, Tailwind CSS" }],
      };
    }
    return {
      content: [{ type: "text", text: "Masar X — Developer AI Assistant Project" }],
    };
  }
);

const transport = new WebStandardStreamableHTTPServerTransport({
  sessionIdGenerator: () => crypto.randomUUID(),
});

// Connect the server to the transport
server.connect(transport).catch(console.error);

export async function GET(request: Request) {
  if (!isAuthorized(request)) return unauthorizedResponse();
  const acceptHeader = request.headers.get("Accept");
  if (acceptHeader && acceptHeader.includes("text/event-stream")) {
    return transport.handleRequest(request);
  }
  return new Response("MCP Server Endpoint (SSE)", { 
    status: 200,
    headers: { "Content-Type": "text/plain" }
  });
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return unauthorizedResponse();
  return transport.handleRequest(request);
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": getAllowedOrigin(request),
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, MCP-Protocol-Version, MCP-Session-ID",
      "Vary": "Origin",
    },
  });
}
