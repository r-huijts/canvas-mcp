import { z } from "zod";
import { CanvasClient } from "../canvasClient.js";

export function registerStudentTools(server: any, canvas: CanvasClient) {
  // Tool: list-students
  server.tool(
    "list-students",
    "Get a complete list of all students enrolled in a specific course",
    {
      courseId: z.string().describe("The ID of the course"),
      includeEmail: z.boolean().default(false).describe("Whether to include student email addresses"),
      anonymous: z.boolean().default(true).describe("Whether to anonymize student names and emails (default: true for privacy)")
    },
    async ({ courseId, includeEmail, anonymous = true }: { courseId: string; includeEmail?: boolean; anonymous?: boolean }) => {
      const students: any[] = [];
      let page = 1;
      let hasMore = true;
      try {
        while (hasMore) {
          const params: any = {
            enrollment_type: ['student'],
            per_page: 100,
            page: page,
            include: ['email', 'avatar_url'],
            enrollment_state: ['active', 'invited']
          };
          const pageStudents = (await canvas.listStudents(courseId, params, { anonymous }) as any[]);
          students.push(...pageStudents);
          hasMore = pageStudents.length === 100;
          page += 1;
        }
        const formattedStudents = students
          .map(student => {
            const parts = [
              `Name: ${student.name}`,
              `ID: ${student.id}`,
              `SIS ID: ${student.sis_user_id || 'N/A'}`,
              `Avatar URL: ${student.avatar_url || 'N/A'}`
            ];
            if (includeEmail && student.email) {
              parts.push(`Email: ${student.email}`);
            }
            return parts.join('\n');
          })
          .join('\n---\n');
        return {
          content: [
            {
              type: "text",
              text: students.length > 0 
                ? `Students in course ${courseId}:\n\n${formattedStudents}\n\nTotal students: ${students.length}`
                : "No students found in this course.",
            },
          ],
        };
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Failed to fetch students: ${error.message}`);
        }
        throw new Error('Failed to fetch students: Unknown error');
      }
    }
  );
} 