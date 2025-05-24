import { z } from "zod";
import { CanvasClient } from "../canvasClient.js";

export function registerSectionTools(server: any, canvas: CanvasClient) {
  // Tool: list-sections
  server.tool(
    "list-sections",
    "Get a list of all sections in a course",
    {
      courseId: z.string().describe("The ID of the course"),
      includeStudentCount: z.boolean().default(false).describe("Whether to include the number of students in each section")
    },
    async ({ courseId, includeStudentCount = false }: { courseId: string; includeStudentCount?: boolean }) => {
      let sections: any[] = [];
      let page = 1;
      let hasMore = true;
      try {
        while (hasMore) {
          const params: any = {
            per_page: 100,
            page: page,
            include: includeStudentCount ? ['total_students'] : []
          };
          const pageSections = (await canvas.listSections(courseId, params) as any[]);
          sections.push(...pageSections);
          hasMore = pageSections.length === 100;
          page += 1;
        }
        const formattedSections = sections
          .map(section => {
            const parts = [
              `Name: ${section.name}`,
              `ID: ${section.id}`,
              `SIS ID: ${section.sis_section_id || 'N/A'}`
            ];
            if (section.start_at) {
              parts.push(`Start Date: ${new Date(section.start_at).toLocaleDateString()}`);
            }
            if (section.end_at) {
              parts.push(`End Date: ${new Date(section.end_at).toLocaleDateString()}`);
            }
            if (includeStudentCount) {
              parts.push(`Total Students: ${section.total_students || 0}`);
            }
            if (section.restrict_enrollments_to_section_dates) {
              parts.push('Restricted to Section Dates: Yes');
            }
            return parts.join('\n');
          })
          .join('\n---\n');
        return {
          content: [
            {
              type: "text",
              text: sections.length > 0
                ? `Sections in course ${courseId}:\n\n${formattedSections}\n\nTotal sections: ${sections.length}`
                : "No sections found in this course.",
            },
          ],
        };
      } catch (error: any) {
        if (error instanceof Error) {
          throw new Error(`Failed to fetch sections: ${error.message}`);
        }
        throw new Error('Failed to fetch sections: Unknown error');
      }
    }
  );

  // Tool: list-section-submissions
  server.tool(
    "list-section-submissions",
    "Get all student submissions for a specific assignment filtered by section",
    {
      courseId: z.string().describe("The ID of the course"),
      assignmentId: z.string().describe("The ID of the assignment"),
      sectionId: z.string().describe("The ID of the section"),
      includeComments: z.boolean().default(true).describe("Whether to include submission comments"),
      anonymous: z.boolean().default(true).describe("Whether to anonymize student names and emails (default: true for privacy)")
    },
    async ({ courseId, assignmentId, sectionId, includeComments = true, anonymous = true }: { courseId: string; assignmentId: string; sectionId: string; includeComments?: boolean; anonymous?: boolean }) => {
      let submissions: any[] = [];
      let page = 1;
      let hasMore = true;
      try {
        await canvas.getSection(courseId, sectionId);

        while (hasMore) {
          const params: any = {
            per_page: 100,
            page: page,
            include: [
              'user',
              'submission_comments',
              'assignment'
            ]
          };
          const pageSubmissions = (await canvas.listSectionAssignmentSubmissions(sectionId, assignmentId, params, { anonymous }) as any[]);
          submissions.push(...pageSubmissions);
          hasMore = pageSubmissions.length === 100;
          page += 1;
        }
        const formattedSubmissions = submissions
          .map(submission => {
            const parts = [
              `Student: ${submission.user?.name || 'Unknown'}`,
              `Status: ${submission.workflow_state}`,
              `Submitted: ${submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : 'Not submitted'}`,
              `Grade: ${submission.grade || 'No grade'}`,
              `Score: ${submission.score !== undefined ? submission.score : 'No score'}`
            ];
            if (submission.late) {
              parts.push('Late: Yes');
            }
            if (submission.missing) {
              parts.push('Missing: Yes');
            }
            if (submission.submission_type) {
              parts.push(`Submission Type: ${submission.submission_type}`);
            }
            if (includeComments && submission.submission_comments?.length > 0) {
              parts.push('\nComments:');
              submission.submission_comments.forEach((comment: any) => {
                const date = new Date(comment.created_at).toLocaleString();
                const author = comment.author?.display_name || 'Unknown';
                const role = comment.author?.role || 'unknown role';
                parts.push(`  [${date}] ${author} (${role}):`);
                parts.push(`    ${comment.comment}`);
              });
            }
            return parts.join('\n');
          })
          .join('\n---\n');
        return {
          content: [
            {
              type: "text",
              text: submissions.length > 0
                ? `Submissions for assignment ${assignmentId} in section ${sectionId}:\n\n${formattedSubmissions}\n\nTotal submissions: ${submissions.length}`
                : "No submissions found for this assignment in this section.",
            },
          ],
        };
      } catch (error: any) {
        if (error instanceof Error) {
          throw new Error(`Failed to fetch section submissions: ${error.message}`);
        }
        throw new Error('Failed to fetch section submissions: Unknown error');
      }
    }
  );
} 