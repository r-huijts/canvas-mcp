import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CanvasClient } from "../canvasClient.js";

export function registerModuleTools(server: McpServer, canvas: CanvasClient) {
  // Tool: list-modules
  server.tool(
    "list-modules",
    "Return all modules in a course (optionally inline items).",
    {
      courseId: z.string().describe("The ID of the course"),
      includeItems: z.boolean().default(false).describe("Whether to include inline items for each module")
    },
    { readOnlyHint: true },
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
    { readOnlyHint: true },
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
    { destructiveHint: false },
    async ({ courseId, moduleId }: { courseId: string; moduleId: string }) => {
      try {
        const current = (await canvas.getModule(courseId, moduleId) as any);
        const newPublished = !current.published;
        await canvas.updateModulePublish(courseId, moduleId, { module: { published: newPublished } });
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

  // Tool: create-module
  server.tool(
    "create-module",
    "Create a new module in a course.",
    {
      courseId: z.string().describe("The ID of the course"),
      name: z.string().describe("The name of the module"),
      position: z.number().optional().describe("Position in the course (1-based)"),
      unlock_at: z.string().optional().describe("Date the module unlocks (ISO 8601)"),
      require_sequential_progress: z.boolean().optional().describe("Whether items must be unlocked in order"),
      prerequisite_module_ids: z.array(z.string()).optional().describe("IDs of modules that must be completed first"),
      publish_final_grade: z.boolean().optional().describe("Publish student's final grade upon completion")
    },
    { destructiveHint: false },
    async (args: any) => {
      const { courseId, ...fields } = args;
      try {
        const mod = await canvas.createModule(courseId, { module: fields }) as any;
        return {
          content: [{ type: "text", text: `Module created: id=${mod.id}, name="${mod.name}", position=${mod.position}, published=${mod.published}` }]
        };
      } catch (error: any) {
        throw new Error(`Failed to create module: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  );

  // Tool: update-module
  server.tool(
    "update-module",
    "Update an existing module's name, position, prerequisites, sequential progress, or published state.",
    {
      courseId: z.string().describe("The ID of the course"),
      moduleId: z.string().describe("The ID of the module"),
      name: z.string().optional(),
      position: z.number().optional(),
      unlock_at: z.string().optional(),
      require_sequential_progress: z.boolean().optional(),
      prerequisite_module_ids: z.array(z.string()).optional(),
      publish_final_grade: z.boolean().optional(),
      published: z.boolean().optional()
    },
    { idempotentHint: true },
    async (args: any) => {
      const { courseId, moduleId, ...fields } = args;
      try {
        const mod = await canvas.updateModule(courseId, moduleId, { module: fields }) as any;
        return {
          content: [{ type: "text", text: `Module updated: id=${mod.id}, name="${mod.name}", position=${mod.position}, published=${mod.published}` }]
        };
      } catch (error: any) {
        throw new Error(`Failed to update module: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  );

  // Tool: delete-module
  server.tool(
    "delete-module",
    "Delete a module from a course. This is permanent and removes all module items.",
    {
      courseId: z.string().describe("The ID of the course"),
      moduleId: z.string().describe("The ID of the module")
    },
    { destructiveHint: true },
    async ({ courseId, moduleId }: { courseId: string; moduleId: string }) => {
      try {
        await canvas.delete(`/api/v1/courses/${courseId}/modules/${moduleId}`);
        return {
          content: [{ type: "text", text: `Module ${moduleId} deleted from course ${courseId}.` }]
        };
      } catch (error: any) {
        throw new Error(`Failed to delete module: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  );

  // Tool: get-module-item
  server.tool(
    "get-module-item",
    "Get details for a single module item.",
    {
      courseId: z.string().describe("The ID of the course"),
      moduleId: z.string().describe("The ID of the module"),
      itemId: z.string().describe("The ID of the module item")
    },
    { readOnlyHint: true },
    async ({ courseId, moduleId, itemId }: { courseId: string; moduleId: string; itemId: string }) => {
      try {
        const item = await canvas.getModuleItem(courseId, moduleId, itemId) as any;
        const summary = {
          id: item.id,
          module_id: item.module_id,
          position: item.position,
          title: item.title,
          type: item.type,
          content_id: item.content_id,
          published: item.published,
          indent: item.indent,
          external_url: item.external_url,
          page_url: item.page_url,
          completion_requirement: item.completion_requirement ?? null,
        };
        return {
          content: [{ type: "text", text: JSON.stringify(summary) }]
        };
      } catch (error: any) {
        throw new Error(`Failed to fetch module item: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  );

  // Tool: create-module-item
  server.tool(
    "create-module-item",
    "Add a new item to a module. Type must be one of: File, Page, Discussion, Assignment, Quiz, SubHeader, ExternalUrl, ExternalTool.",
    {
      courseId: z.string().describe("The ID of the course"),
      moduleId: z.string().describe("The ID of the module"),
      type: z.enum(['File', 'Page', 'Discussion', 'Assignment', 'Quiz', 'SubHeader', 'ExternalUrl', 'ExternalTool']).describe("The type of content to link"),
      content_id: z.string().optional().describe("ID of the content to link (required except for ExternalUrl, Page, SubHeader)"),
      title: z.string().optional().describe("Title of the item"),
      position: z.number().optional().describe("Position in the module (1-based)"),
      indent: z.number().optional().describe("Indent level (0-based)"),
      page_url: z.string().optional().describe("Page URL slug (required for Page type)"),
      external_url: z.string().optional().describe("External URL (required for ExternalUrl and ExternalTool types)"),
      new_tab: z.boolean().optional().describe("Whether ExternalTool opens in a new tab"),
      completion_requirement_type: z.enum(['must_view', 'must_contribute', 'must_submit', 'must_mark_done']).optional().describe("Completion requirement type"),
      completion_requirement_min_score: z.number().optional().describe("Minimum score for must_submit completion requirement")
    },
    { destructiveHint: false },
    async (args: any) => {
      const { courseId, moduleId, completion_requirement_type, completion_requirement_min_score, ...rest } = args;
      const moduleItem: any = { ...rest };
      if (completion_requirement_type) {
        moduleItem.completion_requirement = { type: completion_requirement_type };
        if (completion_requirement_min_score !== undefined) {
          moduleItem.completion_requirement.min_score = completion_requirement_min_score;
        }
      }
      try {
        const item = await canvas.createModuleItem(courseId, moduleId, { module_item: moduleItem }) as any;
        return {
          content: [{ type: "text", text: `Module item created: id=${item.id}, type=${item.type}, title="${item.title}", position=${item.position}` }]
        };
      } catch (error: any) {
        throw new Error(`Failed to create module item: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  );

  // Tool: update-module-item
  server.tool(
    "update-module-item",
    "Update an existing module item's title, position, indent, external URL, published state, completion requirement, or move it to another module.",
    {
      courseId: z.string().describe("The ID of the course"),
      moduleId: z.string().describe("The ID of the module"),
      itemId: z.string().describe("The ID of the module item"),
      title: z.string().optional(),
      position: z.number().optional(),
      indent: z.number().optional(),
      external_url: z.string().optional(),
      new_tab: z.boolean().optional(),
      published: z.boolean().optional(),
      move_to_module_id: z.string().optional().describe("Move this item to a different module"),
      completion_requirement_type: z.enum(['must_view', 'must_contribute', 'must_submit', 'must_mark_done']).optional(),
      completion_requirement_min_score: z.number().optional()
    },
    { idempotentHint: true },
    async (args: any) => {
      const { courseId, moduleId, itemId, completion_requirement_type, completion_requirement_min_score, move_to_module_id, ...rest } = args;
      const moduleItem: any = { ...rest };
      if (move_to_module_id) moduleItem.module_id = move_to_module_id;
      if (completion_requirement_type) {
        moduleItem.completion_requirement = { type: completion_requirement_type };
        if (completion_requirement_min_score !== undefined) {
          moduleItem.completion_requirement.min_score = completion_requirement_min_score;
        }
      }
      try {
        const item = await canvas.updateModuleItem(courseId, moduleId, itemId, { module_item: moduleItem }) as any;
        return {
          content: [{ type: "text", text: `Module item updated: id=${item.id}, type=${item.type}, title="${item.title}", position=${item.position}, published=${item.published}` }]
        };
      } catch (error: any) {
        throw new Error(`Failed to update module item: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  );

  // Tool: delete-module-item
  server.tool(
    "delete-module-item",
    "Remove an item from a module.",
    {
      courseId: z.string().describe("The ID of the course"),
      moduleId: z.string().describe("The ID of the module"),
      itemId: z.string().describe("The ID of the module item")
    },
    { destructiveHint: true },
    async ({ courseId, moduleId, itemId }: { courseId: string; moduleId: string; itemId: string }) => {
      try {
        await canvas.delete(`/api/v1/courses/${courseId}/modules/${moduleId}/items/${itemId}`);
        return {
          content: [{ type: "text", text: `Module item ${itemId} deleted from module ${moduleId}.` }]
        };
      } catch (error: any) {
        throw new Error(`Failed to delete module item: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  );
} 