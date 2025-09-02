import { z } from "zod";
import { CanvasClient } from "../canvasClient.js";

export function registerQuizTools(server: any, canvas: CanvasClient) {
  // Tool: list-quizzes
  server.tool(
    "list-quizzes",
    "Get a list of all quizzes in a course",
    {
      courseId: z.string().describe("The ID of the course"),
    },
    async ({ courseId }: { courseId: string; }) => {
      try {
        const quizzes: any[] = await canvas.get(`/api/v1/courses/${courseId}/quizzes`);
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
    async ({ courseId, quizId }: { courseId: string; quizId: string }) => {
      try {
        const response = await canvas.get(`/api/v1/courses/${courseId}/quizzes/${quizId}`);
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
    async (args: any) => {
      const { courseId, ...fields } = args;
      try {
        const response = await canvas.post(`/api/v1/courses/${courseId}/quizzes`, { quiz: fields });
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
    async (args: any) => {
      const { courseId, quizId, ...fields } = args;
      try {
        const response = await canvas.put(`/api/v1/courses/${courseId}/quizzes/${quizId}`, { quiz: fields });
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
      quizId: z.string().describe("The ID of the quiz")
    },
    async ({ courseId, quizId }: { courseId: string; quizId: string }) => {
      try {
        const response = await canvas.delete(`/api/v1/courses/${courseId}/quizzes/${quizId}`);
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
    async ({ courseId, quizId }: { courseId: string; quizId: string; }) => {
      try {
        const questions: any[] = await canvas.get(`/api/v1/courses/${courseId}/quizzes/${quizId}/questions`);
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
    async ({ courseId, quizId, questionId }: { courseId: string; quizId: string; questionId: string }) => {
      try {
        const question = await canvas.get(`/api/v1/courses/${courseId}/quizzes/${quizId}/questions/${questionId}`);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(question, null, 2)
            }
          ]
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
    async (args: any) => {
      const { courseId, quizId, question } = args;
      try {
        const response = await canvas.post(`/api/v1/courses/${courseId}/quizzes/${quizId}/questions`, { question });
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
    async (args: any) => {
      const { courseId, quizId, questionId, question } = args;
      try {
        const response = await canvas.put(`/api/v1/courses/${courseId}/quizzes/${quizId}/questions/${questionId}`, { question });
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
    async ({ courseId, quizId }: { courseId: string; quizId: string; }) => {
      try {
        const groups = await canvas.get(`/api/v1/courses/${courseId}/quizzes/${quizId}/groups`);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(groups, null, 2)
            },
          ],
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
    async ({ courseId, quizId, groupId }: { courseId: string; quizId: string; groupId: string }) => {
      try {
        const group = await canvas.get(`/api/v1/courses/${courseId}/quizzes/${quizId}/groups/${groupId}`);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(group, null, 2)
            }
          ]
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
    async (args: any) => {
      const { courseId, quizId, quizGroup } = args;
      try {
        const response = await canvas.post(`/api/v1/courses/${courseId}/quizzes/${quizId}/groups`, { quiz_group: quizGroup });
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
    async (args: any) => {
      const { courseId, quizId, groupId, quizGroup } = args;
      try {
        const response = await canvas.put(`/api/v1/courses/${courseId}/quizzes/${quizId}/groups/${groupId}`, { quiz_group: quizGroup });
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
