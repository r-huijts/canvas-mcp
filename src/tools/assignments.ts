import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CanvasClient } from "../canvasClient.js";

export function registerAssignmentTools(server: McpServer, canvas: CanvasClient) {
  // Tool: list-assignments
  server.tool(
    "list-assignments",
    "Get a list of all assignments in a course with submission status for students",
    {
      courseId: z.string().describe("The ID of the course"),
      studentId: z.string().optional().describe("Optional: Get submission status for a specific student"),
      includeSubmissionHistory: z.boolean().default(false).describe("Whether to include submission history details"),
      anonymous: z.boolean().default(true).describe("Whether to anonymize student names and emails in submission data (default: true for privacy)")
    },
    { readOnlyHint: true },
    async ({ courseId, studentId, includeSubmissionHistory = false, anonymous = true }: { courseId: string; studentId?: string; includeSubmissionHistory?: boolean; anonymous?: boolean }) => {
      let assignments: any[] = [];
      let page = 1;
      let hasMore = true;
      try {
        while (hasMore) {
          const params: any = {
            per_page: 100,
            page: page,
            include: studentId ? ['submission', 'submission_comments', 'submission_history'] : [],
            student_ids: studentId ? [studentId] : undefined,
            order_by: 'position',
          };
          const pageAssignments = (await canvas.listCourseAssignments(courseId, params, { anonymous }) as any[]);
          assignments.push(...pageAssignments);
          hasMore = pageAssignments.length === 100;
          page += 1;
        }
        const formattedAssignments = assignments
          .map(assignment => {
            const parts = [
              `Assignment: ${assignment.name}`,
              `ID: ${assignment.id}`,
              `Due Date: ${assignment.due_at || 'No due date'}`,
              `Points Possible: ${assignment.points_possible}`,
              `Status: ${assignment.published ? 'Published' : 'Unpublished'}`
            ];
            if (assignment.submission) {
              parts.push('Submission:');
              parts.push(`  Status: ${assignment.submission.workflow_state}`);
              parts.push(`  Submitted: ${assignment.submission.submitted_at || 'Not submitted'}`);
              if (assignment.submission.score !== undefined) {
                parts.push(`  Score: ${assignment.submission.score}`);
              }
              if (assignment.submission.submission_comments?.length > 0) {
                parts.push('  Teacher Comments:');
                assignment.submission.submission_comments
                  .filter((comment: any) => comment.author?.role === 'teacher')
                  .forEach((comment: any) => {
                    const date = new Date(comment.created_at).toLocaleString();
                    parts.push(`    [${date}] ${comment.comment}`);
                  });
              } else {
                parts.push('  Teacher Comments: None');
              }
              if (includeSubmissionHistory && assignment.submission.versioned_submissions?.length > 0) {
                parts.push('  Submission History:');
                assignment.submission.versioned_submissions
                  .sort((a: any, b: any) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime())
                  .forEach((version: any, index: number) => {
                    const date = new Date(version.submitted_at).toLocaleString();
                    parts.push(`    Attempt ${index + 1} [${date}]:`);
                    if (version.score !== undefined) {
                      parts.push(`      Score: ${version.score}`);
                    }
                    if (version.grade) {
                      parts.push(`      Grade: ${version.grade}`);
                    }
                    if (version.submission_type) {
                      parts.push(`      Type: ${version.submission_type}`);
                    }
                  });
              }
            } else {
              parts.push('Submission: No submission data available');
            }
            return parts.join('\n');
          })
          .join('\n---\n');
        return {
          content: [
            {
              type: "text",
              text: assignments.length > 0
                ? `Assignments in course ${courseId}:\n\n${formattedAssignments}\n\nTotal assignments: ${assignments.length}`
                : "No assignments found in this course.",
            },
          ],
        };
      } catch (error: any) {
        if (error instanceof Error) {
          throw new Error(`Failed to fetch assignments: ${error.message}`);
        }
        throw new Error('Failed to fetch assignments: Unknown error');
      }
    }
  );

  // Tool: get-assignment
  server.tool(
    "get-assignment",
    "Fetch metadata for a single assignment (due date, points, rubric, submission types, etc).",
    {
      courseId: z.string().describe("The ID of the course"),
      assignmentId: z.string().describe("The ID of the assignment")
    },
    { readOnlyHint: true },
    async ({ courseId, assignmentId }: { courseId: string; assignmentId: string }) => {
      try {
        const a = await canvas.getAssignment(courseId, assignmentId) as any;
        const summary = {
          id: a.id,
          name: a.name,
          due_at: a.due_at,
          unlock_at: a.unlock_at,
          lock_at: a.lock_at,
          points_possible: a.points_possible,
          grading_type: a.grading_type,
          submission_types: a.submission_types,
          published: a.published,
          workflow_state: a.workflow_state,
          assignment_group_id: a.assignment_group_id,
          has_rubric: !!(a.rubric_id || a.rubric),
          position: a.position,
        };
        return {
          content: [{ type: "text", text: JSON.stringify(summary) }]
        };
      } catch (error: any) {
        if (error instanceof Error) {
          throw new Error(`Failed to fetch assignment: ${error.message}`);
        }
        throw new Error('Failed to fetch assignment: Unknown error');
      }
    }
  );

  // Tool: create-assignment
  server.tool(
    "create-assignment",
    "Create a new assignment in a course. All fields are optional except courseId.",
    {
      courseId: z.string().describe("The ID of the course"),
      name: z.string().optional(),
      description: z.string().optional(),
      due_at: z.string().optional(),
      points_possible: z.number().optional(),
      submission_types: z.array(z.string()).optional(),
      published: z.boolean().optional(),
      grading_type: z.string().optional(),
      assignment_group_id: z.number().optional(),
    },
    { destructiveHint: false },
    async (args: any) => {
      const { courseId, ...fields } = args;
      try {
        const a = await canvas.createAssignment(courseId, { assignment: fields }) as any;
        return {
          content: [{ type: "text", text: `Assignment created: id=${a.id}, name="${a.name}", points=${a.points_possible}, published=${a.published}` }]
        };
      } catch (error: any) {
        if (error instanceof Error) {
          throw new Error(`Failed to create assignment: ${error.message}`);
        }
        throw new Error('Failed to create assignment: Unknown error');
      }
    }
  );

  // Tool: update-assignment
  server.tool(
    "update-assignment",
    "Update an assignment. All fields are optional except courseId and assignmentId.",
    {
      courseId: z.string().describe("The ID of the course"),
      assignmentId: z.string().describe("The ID of the assignment"),
      name: z.string().optional(),
      description: z.string().optional(),
      due_at: z.string().optional(),
      points_possible: z.number().optional(),
      submission_types: z.array(z.string()).optional(),
      published: z.boolean().optional(),
      grading_type: z.string().optional(),
      assignment_group_id: z.number().optional(),
    },
    { idempotentHint: true },
    async (args: any) => {
      const { courseId, assignmentId, ...fields } = args;
      try {
        const a = await canvas.updateAssignment(courseId, assignmentId, { assignment: fields }) as any;
        return {
          content: [{ type: "text", text: `Assignment updated: id=${a.id}, name="${a.name}", points=${a.points_possible}, published=${a.published}` }]
        };
      } catch (error: any) {
        if (error instanceof Error) {
          throw new Error(`Failed to update assignment: ${error.message}`);
        }
        throw new Error('Failed to update assignment: Unknown error');
      }
    }
  );

  // Tool: delete-assignment
  server.tool(
    "delete-assignment",
    "Delete (archive) an assignment from a course.",
    {
      courseId: z.string().describe("The ID of the course"),
      assignmentId: z.string().describe("The ID of the assignment")
    },
    { destructiveHint: true },
    async ({ courseId, assignmentId }: { courseId: string; assignmentId: string }) => {
      try {
        await canvas.delete(`/api/v1/courses/${courseId}/assignments/${assignmentId}`);
        return {
          content: [{ type: "text", text: `Assignment ${assignmentId} deleted from course ${courseId}.` }]
        };
      } catch (error: any) {
        if (error instanceof Error) {
          throw new Error(`Failed to delete assignment: ${error.message}`);
        }
        throw new Error('Failed to delete assignment: Unknown error');
      }
    }
  );
} 