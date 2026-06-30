import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CanvasClient } from "../canvasClient.js";

export function registerQuizTools(server: McpServer, canvas: CanvasClient) {
  // Tool: list-quizzes
  server.tool(
    "list-quizzes",
    "Get a list of all quizzes in a course",
    {
      courseId: z.string().describe("The ID of the course"),
    },
    { readOnlyHint: true },
    async ({ courseId }: { courseId: string; }) => {
      try {
        const quizzes: any[] = await canvas.fetchAllPages(`/api/v1/courses/${courseId}/quizzes`, { per_page: 100 });
        const formattedQuizzes = quizzes
          .map((quiz: any) => {
            return [
              `Quiz: ${quiz.title}`,
              `ID: ${quiz.id}`,
              `Due Date: ${quiz.due_at || 'No due date'}`,
              `Points Possible: ${quiz.points_possible}`,
              `Status: ${quiz.published ? 'Published' : 'Unpublished'}`
            ].join('\n');
          })
          .join('\n---\n');

        return {
          content: [
            {
              type: "text",
              text: quizzes.length > 0
                ? `Quizzes in course ${courseId}:\n\n${formattedQuizzes}\n\nTotal quizzes: ${quizzes.length}`
                : "No quizzes found in this course.",
            },
          ],
        };
      } catch (error: any) {
        if (error instanceof Error) {
          throw new Error(`Failed to fetch quizzes: ${error.message}`);
        }
        throw new Error('Failed to fetch quizzes: Unknown error');
      }
    }
  );

  // Tool: get-quiz
  server.tool(
    "get-quiz",
    "Fetch metadata for a single quiz",
    {
      courseId: z.string().describe("The ID of the course"),
      quizId: z.string().describe("The ID of the quiz")
    },
    { readOnlyHint: true },
    async ({ courseId, quizId }: { courseId: string; quizId: string }) => {
      try {
        const q = await canvas.get(`/api/v1/courses/${courseId}/quizzes/${quizId}`) as any;
        const summary = {
          id: q.id,
          title: q.title,
          quiz_type: q.quiz_type,
          due_at: q.due_at,
          points_possible: q.points_possible,
          published: q.published,
          time_limit: q.time_limit,
          allowed_attempts: q.allowed_attempts,
          question_count: q.question_count,
          workflow_state: q.workflow_state,
        };
        return {
          content: [{ type: "text", text: JSON.stringify(summary) }]
        };
      } catch (error: any) {
        if (error instanceof Error) {
          throw new Error(`Failed to fetch quiz: ${error.message}`);
        }
        throw new Error('Failed to fetch quiz: Unknown error');
      }
    }
  );

  // Tool: create-quiz
  server.tool(
    "create-quiz",
    "Create a new quiz in a course.",
    {
      courseId: z.string().describe("The ID of the course"),
      title: z.string().describe("The title of the quiz"),
      description: z.string().optional().describe("A description of the quiz"),
      quiz_type: z.enum(["practice_quiz", "assignment", "graded_survey", "survey"]).optional().describe("The type of quiz"),
      due_at: z.string().optional().describe("The due date for the quiz"),
      points_possible: z.number().optional().describe("The point value of the quiz"),
      published: z.boolean().optional().describe("Whether the quiz is published"),
    },
    { destructiveHint: false },
    async (args: any) => {
      const { courseId, ...fields } = args;
      try {
        const q = await canvas.post(`/api/v1/courses/${courseId}/quizzes`, { quiz: fields }) as any;
        return {
          content: [{ type: "text", text: `Quiz created: id=${q.id}, title="${q.title}", published=${q.published}` }]
        };
      } catch (error: any) {
        if (error instanceof Error) {
          throw new Error(`Failed to create quiz: ${error.message}`);
        }
        throw new Error('Failed to create quiz: Unknown error');
      }
    }
  );

  // Tool: update-quiz
  server.tool(
    "update-quiz",
    "Update an existing quiz in a course.",
    {
      courseId: z.string().describe("The ID of the course"),
      quizId: z.string().describe("The ID of the quiz"),
      title: z.string().optional().describe("The title of the quiz"),
      description: z.string().optional().describe("A description of the quiz"),
      quiz_type: z.enum(["practice_quiz", "assignment", "graded_survey", "survey"]).optional().describe("The type of quiz"),
      due_at: z.string().optional().describe("The due date for the quiz"),
      points_possible: z.number().optional().describe("The point value of the quiz"),
      published: z.boolean().optional().describe("Whether the quiz is published"),
    },
    { idempotentHint: true },
    async (args: any) => {
      const { courseId, quizId, ...fields } = args;
      try {
        const q = await canvas.put(`/api/v1/courses/${courseId}/quizzes/${quizId}`, { quiz: fields }) as any;
        return {
          content: [{ type: "text", text: `Quiz updated: id=${q.id}, title="${q.title}", published=${q.published}` }]
        };
      } catch (error: any) {
        if (error instanceof Error) {
          throw new Error(`Failed to update quiz: ${error.message}`);
        }
        throw new Error('Failed to update quiz: Unknown error');
      }
    }
  );

  // Tool: delete-quiz
  server.tool(
    "delete-quiz",
    "Delete a quiz from a course.",
    {
      courseId: z.string().describe("The ID of the course"),
      quizId: z.string().describe("The ID of the quiz"),
    },
    { destructiveHint: true },
    async ({ courseId, quizId }: { courseId: string; quizId: string }) => {
      try {
        await canvas.delete(`/api/v1/courses/${courseId}/quizzes/${quizId}`);
        return {
          content: [{ type: "text", text: `Quiz ${quizId} deleted from course ${courseId}.` }]
        };
      } catch (error: any) {
        if (error instanceof Error) {
          throw new Error(`Failed to delete quiz: ${error.message}`);
        }
        throw new Error('Failed to delete quiz: Unknown error');
      }
    }
  );

  // Tool: list-quiz-questions
  server.tool(
    "list-quiz-questions",
    "Get a list of all questions in a quiz",
    {
      courseId: z.string().describe("The ID of the course"),
      quizId: z.string().describe("The ID of the quiz"),
    },
    { readOnlyHint: true },
    async ({ courseId, quizId }: { courseId: string; quizId: string; }) => {
      try {
        const questions: any[] = await canvas.fetchAllPages(`/api/v1/courses/${courseId}/quizzes/${quizId}/questions`, { per_page: 100 });
        const formattedQuestions = questions
          .map((q: any) => {
            return `ID: ${q.id}, Type: ${q.question_type}, Text: ${q.question_text.substring(0, 100)}...`;
          })
          .join('\n');

        return {
          content: [
            {
              type: "text",
              text: questions.length > 0
                ? `Questions for quiz ${quizId}:\n\n${formattedQuestions}`
                : "No questions found for this quiz.",
            },
          ],
        };
      } catch (error: any) {
        if (error instanceof Error) {
          throw new Error(`Failed to fetch quiz questions: ${error.message}`);
        }
        throw new Error('Failed to fetch quiz questions: Unknown error');
      }
    }
  );

  // Tool: get-quiz-question
  server.tool(
    "get-quiz-question",
    "Fetch a single question from a quiz",
    {
      courseId: z.string().describe("The ID of the course"),
      quizId: z.string().describe("The ID of the quiz"),
      questionId: z.string().describe("The ID of the question"),
    },
    { readOnlyHint: true },
    async ({ courseId, quizId, questionId }: { courseId: string; quizId: string; questionId: string }) => {
      try {
        const q = await canvas.get(`/api/v1/courses/${courseId}/quizzes/${quizId}/questions/${questionId}`) as any;
        const summary = {
          id: q.id,
          question_name: q.question_name,
          question_text: q.question_text,
          question_type: q.question_type,
          points_possible: q.points_possible,
          position: q.position,
          answers: q.answers ?? [],
        };
        return {
          content: [{ type: "text", text: JSON.stringify(summary) }]
        };
      } catch (error: any) {
        if (error instanceof Error) {
          throw new Error(`Failed to fetch quiz question: ${error.message}`);
        }
        throw new Error('Failed to fetch quiz question: Unknown error');
      }
    }
  );

  // Tool: create-quiz-question
  server.tool(
    "create-quiz-question",
    "Create a new question in a quiz.",
    {
      courseId: z.string().describe("The ID of the course"),
      quizId: z.string().describe("The ID of the quiz"),
      question: z.object({
        question_name: z.string().optional(),
        question_text: z.string(),
        question_type: z.string(),
        points_possible: z.number(),
        answers: z.array(z.any()).optional(),
      }).describe("The question object"),
    },
    { destructiveHint: false },
    async (args: any) => {
      const { courseId, quizId, question } = args;
      try {
        const q = await canvas.post(`/api/v1/courses/${courseId}/quizzes/${quizId}/questions`, { question }) as any;
        return {
          content: [{ type: "text", text: `Question created: id=${q.id}, type="${q.question_type}", points=${q.points_possible}` }]
        };
      } catch (error: any) {
        if (error instanceof Error) {
          throw new Error(`Failed to create quiz question: ${error.message}`);
        }
        throw new Error('Failed to create quiz question: Unknown error');
      }
    }
  );

  // Tool: update-quiz-question
  server.tool(
    "update-quiz-question",
    "Update an existing question in a quiz.",
    {
      courseId: z.string().describe("The ID of the course"),
      quizId: z.string().describe("The ID of the quiz"),
      questionId: z.string().describe("The ID of the question"),
      question: z.object({
        question_name: z.string().optional(),
        question_text: z.string().optional(),
        question_type: z.string().optional(),
        points_possible: z.number().optional(),
        answers: z.array(z.any()).optional(),
      }).describe("The question object"),
    },
    { idempotentHint: true },
    async (args: any) => {
      const { courseId, quizId, questionId, question } = args;
      try {
        const q = await canvas.put(`/api/v1/courses/${courseId}/quizzes/${quizId}/questions/${questionId}`, { question }) as any;
        return {
          content: [{ type: "text", text: `Question updated: id=${q.id}, type="${q.question_type}", points=${q.points_possible}` }]
        };
      } catch (error: any) {
        if (error instanceof Error) {
          throw new Error(`Failed to update quiz question: ${error.message}`);
        }
        throw new Error('Failed to update quiz question: Unknown error');
      }
    }
  );

  // Tool: delete-quiz-question
  server.tool(
    "delete-quiz-question",
    "Delete a question from a quiz.",
    {
      courseId: z.string().describe("The ID of the course"),
      quizId: z.string().describe("The ID of the quiz"),
      questionId: z.string().describe("The ID of the question"),
    },
    { destructiveHint: true },
    async ({ courseId, quizId, questionId }: { courseId: string; quizId: string; questionId: string }) => {
      try {
        await canvas.delete(`/api/v1/courses/${courseId}/quizzes/${quizId}/questions/${questionId}`);
        return {
          content: [
            {
              type: "text",
              text: `Successfully deleted question ${questionId} from quiz ${quizId}.`
            }
          ]
        };
      } catch (error: any) {
        if (error instanceof Error) {
          throw new Error(`Failed to delete quiz question: ${error.message}`);
        }
        throw new Error('Failed to delete quiz question: Unknown error');
      }
    }
  );

  // Tool: list-quiz-question-groups
  server.tool(
    "list-quiz-question-groups",
    "Get a list of all question groups in a quiz",
    {
      courseId: z.string().describe("The ID of the course"),
      quizId: z.string().describe("The ID of the quiz"),
    },
    { readOnlyHint: true },
    async ({ courseId, quizId }: { courseId: string; quizId: string; }) => {
      try {
        const raw = await canvas.get(`/api/v1/courses/${courseId}/quizzes/${quizId}/groups`) as any[];
        const groups = raw.map((g: any) => ({
          id: g.id,
          name: g.name,
          pick_count: g.pick_count,
          question_points: g.question_points,
        }));
        return {
          content: [{ type: "text", text: JSON.stringify(groups) }]
        };
      } catch (error: any) {
        if (error instanceof Error) {
          throw new Error(`Failed to fetch quiz question groups: ${error.message}`);
        }
        throw new Error('Failed to fetch quiz question groups: Unknown error');
      }
    }
  );

  // Tool: get-quiz-question-group
  server.tool(
    "get-quiz-question-group",
    "Fetch a single question group from a quiz",
    {
      courseId: z.string().describe("The ID of the course"),
      quizId: z.string().describe("The ID of the quiz"),
      groupId: z.string().describe("The ID of the question group"),
    },
    { readOnlyHint: true },
    async ({ courseId, quizId, groupId }: { courseId: string; quizId: string; groupId: string }) => {
      try {
        const g = await canvas.get(`/api/v1/courses/${courseId}/quizzes/${quizId}/groups/${groupId}`) as any;
        return {
          content: [{ type: "text", text: JSON.stringify({ id: g.id, name: g.name, pick_count: g.pick_count, question_points: g.question_points }) }]
        };
      } catch (error: any) {
        if (error instanceof Error) {
          throw new Error(`Failed to fetch quiz question group: ${error.message}`);
        }
        throw new Error('Failed to fetch quiz question group: Unknown error');
      }
    }
  );

  // Tool: create-quiz-question-group
  server.tool(
    "create-quiz-question-group",
    "Create a new question group in a quiz.",
    {
      courseId: z.string().describe("The ID of the course"),
      quizId: z.string().describe("The ID of the quiz"),
      quizGroup: z.object({
        name: z.string(),
        pick_count: z.number(),
        question_points: z.number(),
      }).describe("The quiz group object"),
    },
    { destructiveHint: false },
    async (args: any) => {
      const { courseId, quizId, quizGroup } = args;
      try {
        const g = await canvas.post(`/api/v1/courses/${courseId}/quizzes/${quizId}/groups`, { quiz_group: quizGroup }) as any;
        return {
          content: [{ type: "text", text: `Question group created: id=${g.id}, name="${g.name}", pick_count=${g.pick_count}, question_points=${g.question_points}` }]
        };
      } catch (error: any) {
        if (error instanceof Error) {
          throw new Error(`Failed to create quiz question group: ${error.message}`);
        }
        throw new Error('Failed to create quiz question group: Unknown error');
      }
    }
  );

  // Tool: update-quiz-question-group
  server.tool(
    "update-quiz-question-group",
    "Update an existing question group in a quiz.",
    {
      courseId: z.string().describe("The ID of the course"),
      quizId: z.string().describe("The ID of the quiz"),
      groupId: z.string().describe("The ID of the group"),
      quizGroup: z.object({
        name: z.string().optional(),
        pick_count: z.number().optional(),
        question_points: z.number().optional(),
      }).describe("The quiz group object"),
    },
    { idempotentHint: true },
    async (args: any) => {
      const { courseId, quizId, groupId, quizGroup } = args;
      try {
        const g = await canvas.put(`/api/v1/courses/${courseId}/quizzes/${quizId}/groups/${groupId}`, { quiz_group: quizGroup }) as any;
        return {
          content: [{ type: "text", text: `Question group updated: id=${g.id}, name="${g.name}", pick_count=${g.pick_count}, question_points=${g.question_points}` }]
        };
      } catch (error: any) {
        if (error instanceof Error) {
          throw new Error(`Failed to update quiz question group: ${error.message}`);
        }
        throw new Error('Failed to update quiz question group: Unknown error');
      }
    }
  );

  // Tool: delete-quiz-question-group
  server.tool(
    "delete-quiz-question-group",
    "Delete a question group from a quiz.",
    {
      courseId: z.string().describe("The ID of the course"),
      quizId: z.string().describe("The ID of the quiz"),
      groupId: z.string().describe("The ID of the group"),
    },
    { destructiveHint: true },
    async ({ courseId, quizId, groupId }: { courseId: string; quizId: string; groupId: string }) => {
      try {
        await canvas.delete(`/api/v1/courses/${courseId}/quizzes/${quizId}/groups/${groupId}`);
        return {
          content: [
            {
              type: "text",
              text: `Successfully deleted group ${groupId} from quiz ${quizId}.`
            }
          ]
        };
      } catch (error: any) {
        if (error instanceof Error) {
          throw new Error(`Failed to delete quiz question group: ${error.message}`);
        }
        throw new Error('Failed to delete quiz question group: Unknown error');
      }
    }
  );
}
