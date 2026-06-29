import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CanvasClient } from "../canvasClient.js";

export function registerSubmissionTools(server: McpServer, canvas: CanvasClient) {
  // Tool: list-assignment-submissions
  server.tool(
    "list-assignment-submissions",
    "Fetch every student's submission status & comments for an assignment.",
    {
      courseId: z.string().describe("The ID of the course"),
      assignmentId: z.string().describe("The ID of the assignment"),
      anonymous: z.boolean().default(true).describe("Whether to anonymize student names and emails (default: true for privacy)")
    },
    { readOnlyHint: true },
    async ({ courseId, assignmentId, anonymous = true }: { courseId: string; assignmentId: string; anonymous?: boolean }) => {
      try {
        const response = await canvas.listAssignmentSubmissions(courseId, assignmentId, {}, { anonymous });
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
          throw new Error(`Failed to fetch assignment submissions: ${error.message}`);
        }
        throw new Error('Failed to fetch assignment submissions: Unknown error');
      }
    }
  );

  // Tool: grade-submission
  server.tool(
    "grade-submission",
    "Write back a score, grade, rubric points, or comment for a student's submission.",
    {
      courseId: z.string().describe("The ID of the course"),
      assignmentId: z.string().describe("The ID of the assignment"),
      userId: z.string().describe("The ID of the student/user"),
      posted_grade: z.string().optional(),
      score: z.number().optional(),
      rubric_assessment: z.any().optional(),
      comment: z.string().optional()
    },
    { idempotentHint: true },
    async ({ courseId, assignmentId, userId, posted_grade, score, rubric_assessment, comment }: { courseId: string; assignmentId: string; userId: string; posted_grade?: string; score?: number; rubric_assessment?: any; comment?: string }) => {
      try {
        const payload: any = {};
        if (posted_grade !== undefined) payload.posted_grade = posted_grade;
        if (score !== undefined) payload.score = score;
        if (rubric_assessment !== undefined) payload.rubric_assessment = rubric_assessment;
        if (comment !== undefined) payload.comment = { text_comment: comment };
        const response = await canvas.gradeSubmission(courseId, assignmentId, userId, payload);
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
          throw new Error(`Failed to grade submission: ${error.message}`);
        }
        throw new Error('Failed to grade submission: Unknown error');
      }
    }
  );

  // Tool: post-submission-comment
  server.tool(
    "post-submission-comment",
    "Attach targeted feedback as a comment on a student's submission.",
    {
      courseId: z.string().describe("The ID of the course"),
      assignmentId: z.string().describe("The ID of the assignment"),
      userId: z.string().describe("The ID of the student/user"),
      comment: z.string().describe("The comment text to post")
    },
    { destructiveHint: false },
    async ({ courseId, assignmentId, userId, comment }: { courseId: string; assignmentId: string; userId: string; comment: string }) => {
      try {
        const response = await canvas.put(
          `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}`,
          { comment: { text_comment: comment } }
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
          throw new Error(`Failed to post submission comment: ${error.message}`);
        }
        throw new Error('Failed to post submission comment: Unknown error');
      }
    }
  );

  // Tool: get-submission-documents
  server.tool(
    "get-submission-documents",
    "Retrieve a student's submission with attachment metadata and optional file downloads. Returns submission details, file information, and optionally the actual file content.",
    {
      courseId: z.string().describe("The ID of the course"),
      assignmentId: z.string().describe("The ID of the assignment"),
      userId: z.string().describe("The ID of the student/user"),
      downloadFiles: z.boolean().default(false).describe("Whether to download the actual file content (default: false, only returns metadata)"),
      anonymous: z.boolean().default(true).describe("Whether to anonymize student information (default: true for privacy)")
    },
    { readOnlyHint: true },
    async ({ courseId, assignmentId, userId, downloadFiles = false, anonymous = true }: { 
      courseId: string; 
      assignmentId: string; 
      userId: string; 
      downloadFiles?: boolean;
      anonymous?: boolean; 
    }) => {
      try {
        const result = await canvas.getSubmissionDocuments(courseId, assignmentId, userId, { 
          downloadFiles, 
          anonymous 
        });
        
        // Format the response nicely
        const response = {
          submission: {
            id: result.submission.id,
            user_id: anonymous ? '[ANONYMIZED]' : result.submission.user_id,
            assignment_id: result.submission.assignment_id,
            submission_type: result.submission.submission_type,
            workflow_state: result.submission.workflow_state,
            submitted_at: result.submission.submitted_at,
            grade: result.submission.grade,
            score: result.submission.score,
            attempt: result.submission.attempt
          },
          text_content: result.textSubmission,
          attachments: result.attachments.map((attachment: any) => ({
            id: attachment.id,
            filename: attachment.filename || attachment.display_name,
            content_type: attachment.content_type,
            size: attachment.size,
            url: downloadFiles ? '[DOWNLOADED_BELOW]' : attachment.url,
            created_at: attachment.created_at
          })),
          downloaded_files: downloadFiles ? result.downloadedFiles.map((file: any) => ({
            id: file.id,
            filename: file.filename,
            content_type: file.contentType,
            size: file.size,
            // Only include base64 data for small files or text files
            has_content: !!file.data,
            content_base64: (file.contentType?.includes('text') || file.size < 1024 * 100) // < 100KB
              ? file.dataBase64 
              : '[FILE_TOO_LARGE_FOR_DISPLAY]',
            error: file.error
          })) : []
        };

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
          throw new Error(`Failed to fetch submission documents: ${error.message}`);
        }
        throw new Error('Failed to fetch submission documents: Unknown error');
      }
    }
  );

  // Tool: get-submission-file-info
  server.tool(
    "get-submission-file-info",
    "Get detailed information about a specific file attached to a submission, including download URLs and metadata.",
    {
      fileId: z.string().describe("The ID of the file to retrieve information for")
    },
    { readOnlyHint: true },
    async ({ fileId }: { fileId: string }) => {
      try {
        const fileInfo = await canvas.getFileInfo(fileId);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(fileInfo, null, 2)
            }
          ]
        };
      } catch (error: any) {
        if (error instanceof Error) {
          throw new Error(`Failed to fetch file information: ${error.message}`);
        }
        throw new Error('Failed to fetch file information: Unknown error');
      }
    }
  );

  // Tool: download-submission-file
  server.tool(
    "download-submission-file",
    "Download the actual content of a file attached to a submission. Returns file content as base64 for binary files or as text for text files.",
    {
      fileId: z.string().describe("The ID of the file to download"),
      forceBase64: z.boolean().default(false).describe("Force return content as base64 even for text files (default: false)")
    },
    { readOnlyHint: true },
    async ({ fileId, forceBase64 = false }: { fileId: string; forceBase64?: boolean }) => {
      try {
        const fileData = await canvas.downloadFile(fileId);
        
        let content: string;
        let contentType = 'base64';
        
        // For text files, try to decode as text unless forceBase64 is true
        if (!forceBase64 && fileData.contentType.includes('text')) {
          try {
            content = Buffer.from(fileData.data).toString('utf-8');
            contentType = 'text';
          } catch {
            // If text decoding fails, fall back to base64
            content = Buffer.from(fileData.data).toString('base64');
            contentType = 'base64';
          }
        } else {
          content = Buffer.from(fileData.data).toString('base64');
          contentType = 'base64';
        }

        const response = {
          filename: fileData.filename,
          content_type: fileData.contentType,
          content_encoding: contentType,
          size: fileData.data.byteLength,
          content: content
        };

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
          throw new Error(`Failed to download file: ${error.message}`);
        }
        throw new Error('Failed to download file: Unknown error');
      }
    }
  );
} 