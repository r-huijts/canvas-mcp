import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CanvasClient } from "../canvasClient.js";

export function registerEportfolioTools(server: McpServer, canvas: CanvasClient) {
  // Tool: list-eportfolios
  server.tool(
    "list-eportfolios",
    "List all ePortfolios belonging to a user. Returns id, name, public flag, workflow state, and timestamps.",
    {
      userId: z.string().describe("The ID of the user")
    },
    { readOnlyHint: true },
    async ({ userId }: { userId: string }) => {
      try {
        const portfolios = await canvas.fetchAllPages<any>(`/api/v1/users/${userId}/eportfolios`);
        const summary = portfolios.map((p: any) => ({
          id: p.id,
          name: p.name,
          public: p.public,
          workflow_state: p.workflow_state,
          created_at: p.created_at,
          updated_at: p.updated_at,
        }));
        return {
          content: [{ type: "text", text: JSON.stringify(summary) }]
        };
      } catch (error: any) {
        throw new Error(`Failed to fetch ePortfolios: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  );

  // Tool: get-eportfolio
  server.tool(
    "get-eportfolio",
    "Get details for a single ePortfolio by ID.",
    {
      eportfolioId: z.string().describe("The ID of the ePortfolio")
    },
    { readOnlyHint: true },
    async ({ eportfolioId }: { eportfolioId: string }) => {
      try {
        const p = await canvas.get<any>(`/api/v1/eportfolios/${eportfolioId}`);
        const summary = {
          id: p.id,
          user_id: p.user_id,
          name: p.name,
          public: p.public,
          workflow_state: p.workflow_state,
          created_at: p.created_at,
          updated_at: p.updated_at,
          spam_status: p.spam_status ?? null,
        };
        return {
          content: [{ type: "text", text: JSON.stringify(summary) }]
        };
      } catch (error: any) {
        throw new Error(`Failed to fetch ePortfolio: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  );

  // Tool: get-eportfolio-pages
  server.tool(
    "get-eportfolio-pages",
    "List all pages in an ePortfolio. Returns id, position, name, content, and timestamps for each page.",
    {
      eportfolioId: z.string().describe("The ID of the ePortfolio")
    },
    { readOnlyHint: true },
    async ({ eportfolioId }: { eportfolioId: string }) => {
      try {
        const pages = await canvas.fetchAllPages<any>(`/api/v1/eportfolios/${eportfolioId}/pages`);
        const summary = pages.map((pg: any) => ({
          id: pg.id,
          eportfolio_id: pg.eportfolio_id,
          position: pg.position,
          name: pg.name,
          content: pg.content,
          created_at: pg.created_at,
          updated_at: pg.updated_at,
        }));
        return {
          content: [{ type: "text", text: JSON.stringify(summary) }]
        };
      } catch (error: any) {
        throw new Error(`Failed to fetch ePortfolio pages: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  );
}
