import { z } from "zod";
import { CanvasClient } from "../canvasClient.js";

export function registerPageTools(server: any, canvas: CanvasClient) {
  // Tool: list-pages
  server.tool(
    "list-pages",
    "List all pages in a course (by URL slug).",
    {
      courseId: z.string().describe("The ID of the course")
    },
    async ({ courseId }: { courseId: string }) => {
      let pages: any[] = [];
      let page = 1;
      let hasMore = true;
      try {
        while (hasMore) {
          const params = { per_page: 100, page: page };
          const pagePages = (await canvas.listPages(courseId, params) as any[]);
          pages.push(...pagePages);
          hasMore = pagePages.length === 100;
          page += 1;
        }
        const formatted = pages.map((p: any) => [
          `Title: ${p.title}`,
          `URL Slug: ${p.url}`,
          `ID: ${p.page_id}`,
          `Published: ${p.published ? 'Yes' : 'No'}`,
          '---'
        ].join('\n')).join('\n');
        return {
          content: [
            {
              type: "text",
              text: pages.length > 0 ? `Pages in course ${courseId}:\n\n${formatted}` : "No pages found in this course."
            }
          ]
        };
      } catch (error: any) {
        if (error instanceof Error) {
          throw new Error(`Failed to fetch pages: ${error.message}`);
        }
        throw new Error('Failed to fetch pages: Unknown error');
      }
    }
  );

  // Tool: get-page-content
  server.tool(
    "get-page-content",
    "Get the content of a specific page by URL slug.",
    {
      courseId: z.string().describe("The ID of the course"),
      pageUrl: z.string().describe("The page's URL slug (e.g., 'syllabus')")
    },
    async ({ courseId, pageUrl }: { courseId: string; pageUrl: string }) => {
      try {
        const page = (await canvas.getPage(courseId, pageUrl) as any);
        return {
          content: [
            {
              type: "text",
              text: [
                `Title: ${page.title}`,
                `URL Slug: ${page.url}`,
                `ID: ${page.page_id}`,
                `Published: ${page.published ? 'Yes' : 'No'}`,
                `Updated At: ${page.updated_at}`,
                '',
                'Body (HTML):',
                page.body || '[No content]'
              ].join('\n')
            }
          ]
        };
      } catch (error: any) {
        if (error instanceof Error) {
          throw new Error(`Failed to fetch page content: ${error.message}`);
        }
        throw new Error('Failed to fetch page content: Unknown error');
      }
    }
  );

  // Tool: update-page-content
  server.tool(
    "update-page-content",
    "Update (or create) a page by URL slug.",
    {
      courseId: z.string().describe("The ID of the course"),
      pageUrl: z.string().describe("The page's URL slug (e.g., 'syllabus')"),
      title: z.string().optional().describe("The new title for the page (optional)"),
      body: z.string().optional().describe("The new HTML body for the page (optional)"),
      editingRoles: z.string().optional().describe("Comma-separated roles allowed to edit (optional)")
    },
    async ({ courseId, pageUrl, title, body, editingRoles }: { courseId: string; pageUrl: string; title?: string; body?: string; editingRoles?: string }) => {
      try {
        const wiki_page: any = {};
        if (title !== undefined) wiki_page.title = title;
        if (body !== undefined) wiki_page.body = body;
        if (editingRoles !== undefined) wiki_page.editing_roles = editingRoles;
        const page = (await canvas.updateOrCreatePage(courseId, pageUrl, { wiki_page }) as any);
        return {
          content: [
            {
              type: "text",
              text: [
                `Page '${page.url}' updated in course ${courseId}.`,
                `Title: ${page.title}`,
                `ID: ${page.page_id}`,
                `Published: ${page.published ? 'Yes' : 'No'}`,
                `Updated At: ${page.updated_at}`
              ].join('\n')
            }
          ]
        };
      } catch (error: any) {
        if (error instanceof Error) {
          throw new Error(`Failed to update page: ${error.message}`);
        }
        throw new Error('Failed to update page: Unknown error');
      }
    }
  );

  // Tool: list-page-revisions
  server.tool(
    "list-page-revisions",
    "List all revisions for a page.",
    {
      courseId: z.string().describe("The ID of the course"),
      pageUrl: z.string().describe("The page's URL slug (e.g., 'syllabus')")
    },
    async ({ courseId, pageUrl }: { courseId: string; pageUrl: string }) => {
      try {
        const revisions = (await canvas.listPageRevisions(courseId, pageUrl) as any[]);
        const formatted = revisions.map((rev: any) => [
          `Revision ID: ${rev.id}`,
          `Updated At: ${rev.updated_at}`,
          `Edited By: ${rev.edited_by?.display_name || rev.edited_by_id || 'Unknown'}`,
          '---'
        ].join('\n')).join('\n');
        return {
          content: [
            {
              type: "text",
              text: revisions.length > 0 ? `Revisions for page '${pageUrl}' in course ${courseId}:\n\n${formatted}` : "No revisions found for this page."
            }
          ]
        };
      } catch (error: any) {
        if (error instanceof Error) {
          throw new Error(`Failed to fetch page revisions: ${error.message}`);
        }
        throw new Error('Failed to fetch page revisions: Unknown error');
      }
    }
  );

  // Tool: revert-page-revision
  server.tool(
    "revert-page-revision",
    "Revert a page to a previous revision.",
    {
      courseId: z.string().describe("The ID of the course"),
      pageUrl: z.string().describe("The page's URL slug (e.g., 'syllabus')"),
      revisionId: z.string().describe("The ID of the revision to revert to")
    },
    async ({ courseId, pageUrl, revisionId }: { courseId: string; pageUrl: string; revisionId: string }) => {
      try {
        const page = (await canvas.revertPageRevision(courseId, pageUrl, revisionId) as any);
        return {
          content: [
            {
              type: "text",
              text: [
                `Page '${pageUrl}' in course ${courseId} reverted to revision ${revisionId}.`,
                `Title: ${page.title}`,
                `ID: ${page.page_id}`,
                `Published: ${page.published ? 'Yes' : 'No'}`,
                `Updated At: ${page.updated_at}`
              ].join('\n')
            }
          ]
        };
      } catch (error: any) {
        if (error instanceof Error) {
          throw new Error(`Failed to revert page revision: ${error.message}`);
        }
        throw new Error('Failed to revert page revision: Unknown error');
      }
    }
  );
} 