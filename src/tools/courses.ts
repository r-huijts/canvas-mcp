import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CanvasClient } from "../canvasClient.js";
import { Course, Announcement } from "../types.js";

export function registerCourseTools(server: McpServer, canvas: CanvasClient) {
  // Tool: list-courses
  server.tool(
    "list-courses",
    "List all active courses for the authenticated user. Returns course name, ID, course code, and term for each course.",
    {},
    { readOnlyHint: true },
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
    { destructiveHint: false },
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

  // Tool: list-announcements
  server.tool(
    "list-announcements",
    "List all announcements in a specific course. Returns title, ID, posted date, published state, and unread count.",
    {
      courseId: z.string().describe("The ID of the course"),
      published: z.boolean().optional().describe("Filter by published state (true = published only, false = unpublished only)"),
      per_page: z.number().optional().describe("Number of announcements to fetch per page (default: 100)")
    },
    { readOnlyHint: true },
    async ({ courseId, published, per_page }: { courseId: string; published?: boolean; per_page?: number }) => {
      try {
        const params: any = {};
        if (published !== undefined) params.published = published;
        if (per_page !== undefined) params.per_page = per_page;
        const announcements: Announcement[] = (await canvas.listAnnouncements(courseId, params)) as any;
        const formatted = announcements.map((announcement: Announcement) => {
          const posted = announcement.posted_at ? new Date(announcement.posted_at).toLocaleString() : 'Not posted';
          return `Announcement: ${announcement.title}\nID: ${announcement.id}\nPosted: ${posted}\nPublished: ${announcement.published}\nUnread count: ${announcement.unread_count ?? 'N/A'}\n---`;
        }).join('\n');
        return {
          content: [
            {
              type: "text",
              text: formatted ?
                `Announcements in course ${courseId}:\n\n${formatted}` :
                `No announcements found in course ${courseId}.`,
            },
          ],
        };
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Failed to fetch announcements: ${error.message}`);
        }
        throw new Error('Failed to fetch announcements: Unknown error');
      }
    }
  );

  // Tool: get-announcement
  server.tool(
    "get-announcement",
    "Get the full details of a specific announcement, including its HTML message body.",
    {
      courseId: z.string().describe("The ID of the course"),
      announcementId: z.string().describe("The ID of the announcement (discussion topic ID)")
    },
    { readOnlyHint: true },
    async ({ courseId, announcementId }: { courseId: string; announcementId: string }) => {
      try {
        const announcement: Announcement = (await canvas.getAnnouncement(courseId, announcementId)) as any;
        const posted = announcement.posted_at ? new Date(announcement.posted_at).toLocaleString() : 'Not posted';
        return {
          content: [
            {
              type: "text",
              text: `Announcement: ${announcement.title}\nID: ${announcement.id}\nPosted: ${posted}\nPublished: ${announcement.published}\nAuthor: ${announcement.author?.display_name ?? 'Unknown'}\nURL: ${announcement.html_url ?? 'N/A'}\n\n${announcement.message ?? 'No message content'}`,
            },
          ],
        };
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Failed to fetch announcement: ${error.message}`);
        }
        throw new Error('Failed to fetch announcement: Unknown error');
      }
    }
  );

  // Tool: update-announcement
  server.tool(
    "update-announcement",
    "Update an existing announcement. At least one optional field must be provided.",
    {
      courseId: z.string().describe("The ID of the course"),
      announcementId: z.string().describe("The ID of the announcement (discussion topic ID)"),
      title: z.string().optional().describe("New title for the announcement"),
      message: z.string().optional().describe("New HTML message content for the announcement"),
      published: z.boolean().optional().describe("Whether the announcement should be published")
    },
    { idempotentHint: true },
    async ({ courseId, announcementId, title, message, published }: { courseId: string; announcementId: string; title?: string; message?: string; published?: boolean }) => {
      try {
        const data: any = {};
        if (title !== undefined) data.title = title;
        if (message !== undefined) data.message = message;
        if (published !== undefined) data.published = published;
        await canvas.updateAnnouncement(courseId, announcementId, data);
        return {
          content: [
            {
              type: "text",
              text: `Successfully updated announcement ${announcementId} in course ${courseId}`,
            },
          ],
        };
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Failed to update announcement: ${error.message}`);
        }
        throw new Error('Failed to update announcement: Unknown error');
      }
    }
  );

  // Tool: delete-announcement
  server.tool(
    "delete-announcement",
    "Delete an announcement from a course. This action cannot be undone.",
    {
      courseId: z.string().describe("The ID of the course"),
      announcementId: z.string().describe("The ID of the announcement (discussion topic ID)"),
    },
    { destructiveHint: true },
    async ({ courseId, announcementId }: { courseId: string; announcementId: string }) => {
      try {
        await canvas.deleteAnnouncement(courseId, announcementId);
        return {
          content: [
            {
              type: "text",
              text: `Successfully deleted announcement ${announcementId} from course ${courseId}`,
            },
          ],
        };
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Failed to delete announcement: ${error.message}`);
        }
        throw new Error('Failed to delete announcement: Unknown error');
      }
    }
  );
} 