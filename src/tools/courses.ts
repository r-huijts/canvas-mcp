import { z } from "zod";
import { CanvasClient } from "../canvasClient.js";
import { Course, Rubric } from "../types.js";

export function registerCourseTools(server: any, canvas: CanvasClient) {
  // Tool: list-courses
  server.tool(
    "list-courses",
    "List all courses for the authenticated user",
    {},
    async () => {
      try {
        const courses: Course[] = (await canvas.listCourses({
          enrollment_state: 'active',
          state: ['available'],
          per_page: 100,
          include: ['term']
        }) as any) as Course[];
        const formattedCourses = courses
          .filter(course => course.workflow_state === 'available')
          .map((course: Course) => {
            const termInfo = course.term ? ` (${course.term.name})` : '';
            return `Course: ${course.name}${termInfo}\nID: ${course.id}\nCode: ${course.course_code}\n---`;
          })
          .join('\n');
        return {
          content: [
            {
              type: "text",
              text: formattedCourses ?
                `Available Courses:\n\n${formattedCourses}` :
                "No active courses found.",
            },
          ],
        };
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Failed to fetch courses: ${error.message}`);
        }
        throw new Error('Failed to fetch courses: Unknown error');
      }
    }
  );

  // Tool: post-announcement
  server.tool(
    "post-announcement",
    "Post an announcement to a specific course",
    {
      courseId: z.string().describe("The ID of the course"),
      title: z.string().describe("The title of the announcement"),
      message: z.string().describe("The content of the announcement")
    },
    async ({ courseId, title, message }: { courseId: string; title: string; message: string }) => {
      try {
        await canvas.postAnnouncement(courseId, {
          title,
          message,
          is_announcement: true,
        });
        return {
          content: [
            {
              type: "text",
              text: `Successfully posted announcement "${title}" to course ${courseId}`,
            },
          ],
        };
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Failed to post announcement: ${error.message}`);
        }
        throw new Error('Failed to post announcement: Unknown error');
      }
    }
  );
} 