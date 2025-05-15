import { z } from "zod";
import { CanvasClient } from "../canvasClient.js";
import { Rubric, RubricStat } from "../types.js";
import { calculateMedian } from "../rubricUtils.js";

export function registerRubricTools(server: any, canvas: CanvasClient) {
  // Tool: list-rubrics
  server.tool(
    "list-rubrics",
    "List all rubrics for a specific course",
    {
      courseId: z.string().describe("The ID of the course")
    },
    async ({ courseId }: { courseId: string }) => {
      try {
        const rubrics: Rubric[] = await canvas.get(
          `/api/v1/courses/${courseId}/rubrics`
        );
        const formattedRubrics = rubrics.map((rubric: Rubric) => 
          `Rubric: ${rubric.title}\nID: ${rubric.id}\nDescription: ${rubric.description || 'No description'}\n---`
        ).join('\n');
        return {
          content: [
            {
              type: "text",
              text: formattedRubrics || "No rubrics found for this course",
            },
          ],
        };
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Failed to fetch rubrics: ${error.message}`);
        }
        throw new Error('Failed to fetch rubrics: Unknown error');
      }
    }
  );

  // Tool: get-rubric-statistics
  server.tool(
    "get-rubric-statistics",
    "Get statistics for rubric assessments on an assignment",
    {
      courseId: z.string().describe("The ID of the course"),
      assignmentId: z.string().describe("The ID of the assignment"),
      includePointDistribution: z.boolean().default(true).describe("Whether to include point distribution for each criterion")
    },
    async ({ courseId, assignmentId, includePointDistribution = true }: { courseId: string; assignmentId: string; includePointDistribution?: boolean }) => {
      try {
        // First get the assignment details with rubric
        const response = await canvas.get(
          `/api/v1/courses/${courseId}/assignments/${assignmentId}`,
          {
            params: {
              include: ['rubric']
            }
          }
        ) as any;
        if (!response.rubric) {
          throw new Error('No rubric found for this assignment');
        }
        // Get all submissions with rubric assessments
        const submissions = await canvas.fetchAllPages(
          `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions`,
          {
            params: {
              include: ['rubric_assessment'],
              per_page: 100
            }
          }
        );
        // Calculate statistics for each rubric criterion
        const rubricStats = (response.rubric as any[]).map((criterion: any) => {
          const scores = submissions
            .filter((sub: any) => sub.rubric_assessment?.[criterion.id]?.points !== undefined)
            .map((sub: any) => sub.rubric_assessment[criterion.id].points);
          const stats: RubricStat = {
            id: criterion.id,
            description: criterion.description,
            points_possible: criterion.points,
            total_assessments: scores.length,
            average_score: 0,
            median_score: 0,
            min_score: 0,
            max_score: 0
          };
          if (scores.length > 0) {
            stats.average_score = Number((scores.reduce((a: number, b: number) => a + b, 0) / scores.length).toFixed(2));
            stats.median_score = calculateMedian(scores);
            stats.min_score = Math.min(...scores);
            stats.max_score = Math.max(...scores);
          }
          if (includePointDistribution) {
            const distribution: { [key: number]: number } = {};
            scores.forEach((score: number) => {
              distribution[score] = (distribution[score] || 0) + 1;
            });
            stats.point_distribution = distribution;
          }
          return stats;
        });
        // Calculate overall statistics
        const totalScores = submissions
          .filter((sub: any) => sub.rubric_assessment)
          .map((sub: any) => {
            return Object.values(sub.rubric_assessment)
              .reduce((sum: number, assessment: any) => sum + (assessment.points || 0), 0);
          });
        const overallStats = {
          total_submissions: submissions.length,
          submissions_with_assessment: totalScores.length,
          overall_average: 0,
          overall_median: 0,
          overall_min: 0,
          overall_max: 0
        };
        if (totalScores.length > 0) {
          overallStats.overall_average = Number((totalScores.reduce((a, b) => a + b, 0) / totalScores.length).toFixed(2));
          overallStats.overall_median = calculateMedian(totalScores);
          overallStats.overall_min = Math.min(...totalScores);
          overallStats.overall_max = Math.max(...totalScores);
        }
        const formattedStats = [
          'Overall Statistics:',
          `Total Submissions: ${overallStats.total_submissions}`,
          `Submissions with Assessment: ${overallStats.submissions_with_assessment}`,
          `Average Score: ${overallStats.overall_average}`,
          `Median Score: ${overallStats.overall_median}`,
          `Min Score: ${overallStats.overall_min}`,
          `Max Score: ${overallStats.overall_max}`,
          '\nCriterion Statistics:',
          ...rubricStats.map((stat: any) => {
            const parts = [
              `\nCriterion: ${stat.description}`,
              `Points Possible: ${stat.points_possible}`,
              `Total Assessments: ${stat.total_assessments}`,
              `Average Score: ${stat.average_score}`,
              `Median Score: ${stat.median_score}`,
              `Min Score: ${stat.min_score}`,
              `Max Score: ${stat.max_score}`
            ];
            if (includePointDistribution && stat.point_distribution) {
              parts.push('\nPoint Distribution:');
              Object.entries(stat.point_distribution)
                .sort(([a], [b]) => Number(b) - Number(a))
                .forEach(([score, count]) => {
                  const percentage = (((count as number) / stat.total_assessments) * 100).toFixed(1);
                  parts.push(`  ${score} points: ${count} submissions (${percentage}%)`);
                });
            }
            return parts.join('\n');
          })
        ].join('\n');
        return {
          content: [
            {
              type: "text",
              text: formattedStats
            }
          ]
        };
      } catch (error: any) {
        if (error.response?.status === 404) {
          throw new Error(`Assignment ${assignmentId} not found in course ${courseId}`);
        }
        if (error.response?.errors) {
          throw new Error(`Failed to fetch rubric statistics: ${JSON.stringify(error.response.errors)}`);
        }
        throw new Error(`Failed to fetch rubric statistics: ${error.message}`);
      }
    }
  );

  // Tool: list-rubric-assessments
  server.tool(
    "list-rubric-assessments",
    "List all rubric assessments for an assignment.",
    {
      courseId: z.string().describe("The ID of the course"),
      assignmentId: z.string().describe("The ID of the assignment")
    },
    async ({ courseId, assignmentId }: { courseId: string; assignmentId: string }) => {
      try {
        const rubricAssessments = await canvas.get(
          `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions`,
          { 'include[]': 'rubric_assessment' }
        ) as any[];
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(rubricAssessments, null, 2)
            }
          ]
        };
      } catch (error: any) {
        if (error instanceof Error) {
          throw new Error(`Failed to fetch rubric assessments: ${error.message}`);
        }
        throw new Error('Failed to fetch rubric assessments: Unknown error');
      }
    }
  );

  // Tool: attach-rubric-to-assignment
  server.tool(
    "attach-rubric-to-assignment",
    "Attach a rubric to an assignment.",
    {
      courseId: z.string().describe("The ID of the course"),
      assignmentId: z.string().describe("The ID of the assignment"),
      rubricId: z.string().describe("The ID of the rubric to attach")
    },
    async ({ courseId, assignmentId, rubricId }: { courseId: string; assignmentId: string; rubricId: string }) => {
      try {
        const result = await canvas.put(
          `/api/v1/courses/${courseId}/assignments/${assignmentId}?rubric_id=${encodeURIComponent(rubricId)}`
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error: any) {
        if (error instanceof Error) {
          throw new Error(`Failed to attach rubric: ${error.message}`);
        }
        throw new Error('Failed to attach rubric: Unknown error');
      }
    }
  );
} 