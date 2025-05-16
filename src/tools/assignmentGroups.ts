import { z } from "zod";
import { CanvasClient } from "../canvasClient.js";

export function registerAssignmentGroupTools(server: any, canvas: CanvasClient) {
  // Tool: list-assignment-groups
  server.tool(
    "list-assignment-groups",
    "List all assignment groups (buckets) in a course.",
    {
      courseId: z.string().describe("The ID of the course")
    },
    async ({ courseId }: { courseId: string }) => {
      try {
        const response = await canvas.listAssignmentGroups(courseId);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2)
            }
          ]
        };
      } catch (error: any) {
        if (error instanceof Error) {
          throw new Error(`Failed to fetch assignment groups: ${error.message}`);
        }
        throw new Error('Failed to fetch assignment groups: Unknown error');
      }
    }
  );

  // Tool: create-assignment-group
  server.tool(
    "create-assignment-group",
    "Create a new assignment group (bucket) in a course. All fields optional except courseId.",
    {
      courseId: z.string().describe("The ID of the course"),
      name: z.string().optional(),
      position: z.number().optional(),
      group_weight: z.number().optional(),
      sis_source_id: z.string().optional(),
      integration_data: z.any().optional(),
      rules: z.any().optional()
    },
    async (args: any) => {
      const { courseId, ...fields } = args;
      try {
        const response = await canvas.createAssignmentGroup(courseId, { assignment_group: fields });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2)
            }
          ]
        };
      } catch (error: any) {
        if (error instanceof Error) {
          throw new Error(`Failed to create assignment group: ${error.message}`);
        }
        throw new Error('Failed to create assignment group: Unknown error');
      }
    }
  );

  // Tool: bulk-update-assignment-dates
  server.tool(
    "bulk-update-assignment-dates",
    "Bulk update due/unlock/lock dates for assignments in a course.",
    {
      courseId: z.string().describe("The ID of the course"),
      assignmentDates: z.array(z.object({
        assignment_id: z.string().describe("The ID of the assignment"),
        due_at: z.string().optional().describe("New due date (ISO 8601)"),
        unlock_at: z.string().optional().describe("New unlock date (ISO 8601)"),
        lock_at: z.string().optional().describe("New lock date (ISO 8601)")
      })).describe("Array of assignment date updates")
    },
    async ({ courseId, assignmentDates }: { courseId: string; assignmentDates: any[] }) => {
      try {
        // Note: A specific client method for this bulk update could be added to CanvasClient
        // For now, using the generic put method directly.
        const response = await canvas.put(
          `/api/v1/courses/${courseId}/assignments/bulk_update`,
          { assignment_dates: assignmentDates }
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2)
            }
          ]
        };
      } catch (error: any) {
        if (error instanceof Error) {
          throw new Error(`Failed to bulk update assignment dates: ${error.message}`);
        }
        throw new Error('Failed to bulk update assignment dates: Unknown error');
      }
    }
  );
} 