import { z } from "zod";
import { CanvasClient } from "../canvasClient.js";

export function registerModuleTools(server: any, canvas: CanvasClient) {
  // Tool: list-modules
  server.tool(
    "list-modules",
    "Return all modules in a course (optionally inline items).",
    {
      courseId: z.string().describe("The ID of the course"),
      includeItems: z.boolean().default(false).describe("Whether to include inline items for each module")
    },
    async ({ courseId, includeItems }: { courseId: string; includeItems?: boolean }) => {
      let modules: any[] = [];
      let page = 1;
      let hasMore = true;
      try {
        while (hasMore) {
          const params: any = {
            per_page: 100,
            page: page,
            ...(includeItems ? { 'include[]': 'items' } : {})
          };
          const pageModules = (await canvas.listModules(courseId, params) as any[]);
          modules.push(...pageModules);
          hasMore = pageModules.length === 100;
          page += 1;
        }
        const formatted = modules.map((mod: any) => {
          const lines = [
            `Module: ${mod.name}`,
            `ID: ${mod.id}`,
            `Position: ${mod.position}`,
            `Published: ${mod.published ? 'Yes' : 'No'}`
          ];
          if (includeItems && mod.items) {
            lines.push('Items:');
            mod.items.forEach((item: any) => {
              lines.push(`  - [${item.type}] ${item.title || item.page_url || item.url || 'Untitled'} (ID: ${item.id})`);
            });
          }
          lines.push('---');
          return lines.join('\n');
        }).join('\n');
        return {
          content: [
            {
              type: "text",
              text: modules.length > 0 ? `Modules in course ${courseId}:\n\n${formatted}` : "No modules found in this course."
            }
          ]
        };
      } catch (error: any) {
        if (error instanceof Error) {
          throw new Error(`Failed to fetch modules: ${error.message}`);
        }
        throw new Error('Failed to fetch modules: Unknown error');
      }
    }
  );

  // Tool: list-module-items
  server.tool(
    "list-module-items",
    "Given a module ID, list its items (pages, quizzes, files, etc).",
    {
      courseId: z.string().describe("The ID of the course"),
      moduleId: z.string().describe("The ID of the module")
    },
    async ({ courseId, moduleId }: { courseId: string; moduleId: string }) => {
      let items: any[] = [];
      let page = 1;
      let hasMore = true;
      try {
        while (hasMore) {
          const params = { per_page: 100, page: page };
          const pageItems = (await canvas.listModuleItems(courseId, moduleId, params) as any[]);
          items.push(...pageItems);
          hasMore = pageItems.length === 100;
          page += 1;
        }
        const formatted = items.map((item: any) => {
          return [
            `Type: ${item.type}`,
            `Title: ${item.title || item.page_url || item.url || 'Untitled'}`,
            `ID: ${item.id}`,
            `Position: ${item.position}`,
            `Published: ${item.published ? 'Yes' : 'No'}`,
            '---'
          ].join('\n');
        }).join('\n');
        return {
          content: [
            {
              type: "text",
              text: items.length > 0 ? `Items in module ${moduleId} (course ${courseId}):\n\n${formatted}` : "No items found in this module."
            }
          ]
        };
      } catch (error: any) {
        if (error instanceof Error) {
          throw new Error(`Failed to fetch module items: ${error.message}`);
        }
        throw new Error('Failed to fetch module items: Unknown error');
      }
    }
  );

  // Tool: toggle-module-publish
  server.tool(
    "toggle-module-publish",
    "Publish/unpublish a module (toggles the current published state).",
    {
      courseId: z.string().describe("The ID of the course"),
      moduleId: z.string().describe("The ID of the module")
    },
    async ({ courseId, moduleId }: { courseId: string; moduleId: string }) => {
      try {
        const current = (await canvas.getModule(courseId, moduleId) as any);
        const newPublished = !current.published;
        await canvas.updateModulePublish(courseId, moduleId, { published: newPublished });
        return {
          content: [
            {
              type: "text",
              text: `Module ${moduleId} in course ${courseId} is now ${newPublished ? 'published' : 'unpublished'}.`
            }
          ]
        };
      } catch (error: any) {
        if (error instanceof Error) {
          throw new Error(`Failed to toggle module publish: ${error.message}`);
        }
        throw new Error('Failed to toggle module publish: Unknown error');
      }
    }
  );
} 