import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";

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
  return transport.handleRequest(request);
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, MCP-Protocol-Version, MCP-Session-ID",
    },
  });
}
