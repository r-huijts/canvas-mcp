import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import axios from 'axios';
import * as dotenv from "dotenv";
import { CanvasConfig, Course, Rubric } from './types.js';

// Load environment variables
dotenv.config();

// Interface for rubric statistics
interface RubricStat {
  id: string;
  description: string;
  points_possible: number;
  total_assessments: number;
  average_score: number;
  median_score: number;
  min_score: number;
  max_score: number;
  point_distribution?: { [key: number]: number };
}

// Create the MCP server
const server = new McpServer({
  name: "Canvas MCP Server",
  version: "1.0.0"
});

// Read configuration from environment variables
const config: CanvasConfig = {
  apiToken: process.env.CANVAS_API_TOKEN || "",
  baseUrl: process.env.CANVAS_BASE_URL || "https://fhict.instructure.com",
};

// Validate configuration
if (!config.apiToken) {
  console.error("Error: CANVAS_API_TOKEN environment variable is required");
  process.exit(1);
}

// Initialize axios instance with base configuration
const axiosInstance = axios.create({
  baseURL: config.baseUrl,
  headers: {
    Authorization: `Bearer ${config.apiToken}`,
  },
});

// Helper method to calculate median
function calculateMedian(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  
  const sorted = [...numbers].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return Number(((sorted[middle - 1] + sorted[middle]) / 2).toFixed(2));
  }
  return Number(sorted[middle].toFixed(2));
}

// Helper method to fetch all pages
async function fetchAllPages(url: string, config: any): Promise<any[]> {
  let results: any[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await axiosInstance.get(url, {
      ...config,
      params: {
        ...config.params,
        page: page
      }
    });

    const pageData = response.data;
    results.push(...pageData);

    hasMore = pageData.length === (config.params.per_page || 10);
    page += 1;
  }

  return results;
}

// Register tools using the new tool registration pattern
// Tool: list-courses
server.tool(
  "list-courses",
  "List all courses for the authenticated user",
  {},
  async () => {
    try {
      // Get all active courses with pagination
      const response = await axiosInstance.get('/api/v1/courses', {
        params: {
          enrollment_state: 'active', // Only get active enrollments
          state: ['available'], // Only get available courses
          per_page: 100, // Get up to 100 courses per page
          include: ['term'] // Include term info to help identify current courses
        }
      });

      const courses: Course[] = response.data;

      // Filter and format the courses
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
  async ({ courseId, title, message }) => {
    try {
      await axiosInstance.post(
        `/api/v1/courses/${courseId}/discussion_topics`,
        {
          title,
          message,
          is_announcement: true,
        }
      );

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

// Tool: list-rubrics
server.tool(
  "list-rubrics",
  "List all rubrics for a specific course",
  {
    courseId: z.string().describe("The ID of the course")
  },
  async ({ courseId }) => {
    try {
      const response = await axiosInstance.get(
        `/api/v1/courses/${courseId}/rubrics`
      );
      const rubrics: Rubric[] = response.data;

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

// Tool: list-students
server.tool(
  "list-students",
  "Get a complete list of all students enrolled in a specific course",
  {
    courseId: z.string().describe("The ID of the course"),
    includeEmail: z.boolean().default(false).describe("Whether to include student email addresses")
  },
  async ({ courseId, includeEmail }) => {
    const students = [];
    let page = 1;
    let hasMore = true;

    try {
      // Fetch all pages of students
      while (hasMore) {
        const response = await axiosInstance.get(
          `/api/v1/courses/${courseId}/users`,
          {
            params: {
              enrollment_type: ['student'], // Only get students
              per_page: 100, // Maximum page size
              page: page,
              include: ['email', 'avatar_url'], // Added avatar_url to includes
              enrollment_state: ['active', 'invited'] // Get both active and invited students
            }
          }
        );

        const pageStudents = response.data;
        students.push(...pageStudents);

        // Check if there are more pages
        hasMore = pageStudents.length === 100;
        page += 1;
      }

      // Format the student list
      const formattedStudents = students
        .map(student => {
          const parts = [
            `Name: ${student.name}`,
            `ID: ${student.id}`,
            `SIS ID: ${student.sis_user_id || 'N/A'}`,
            `Avatar URL: ${student.avatar_url || 'N/A'}`  // Added avatar URL
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

// Tool: list-assignments
server.tool(
  "list-assignments",
  "Get a list of all assignments in a course with submission status for students",
  {
    courseId: z.string().describe("The ID of the course"),
    studentId: z.string().optional().describe("Optional: Get submission status for a specific student"),
    includeSubmissionHistory: z.boolean().default(false).describe("Whether to include submission history details")
  },
  async ({ courseId, studentId, includeSubmissionHistory = false }) => {
    let assignments = [];
    let page = 1;
    let hasMore = true;

    try {
      // Fetch all pages of assignments with submission and comment data
      while (hasMore) {
        const response = await axiosInstance.get(
          `/api/v1/courses/${courseId}/assignments`,
          {
            params: {
              per_page: 100,
              page: page,
              // Always include submission history when studentId is provided
              include: studentId ? ['submission', 'submission_comments', 'submission_history'] : [],
              student_ids: studentId ? [studentId] : undefined,
              order_by: 'position',
            }
          }
        );

        console.error(`Fetched ${response.data.length} assignments from page ${page}`);

        const pageAssignments = response.data;
        assignments.push(...pageAssignments);

        hasMore = pageAssignments.length === 100;
        page += 1;
      }

      // Format the assignments list
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

            // Enhanced submission history handling
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
      console.error('Full error details:', error.response?.data || error);
      if (error.response?.data?.errors) {
        throw new Error(`Failed to fetch assignments: ${JSON.stringify(error.response.data.errors)}`);
      }
      if (error instanceof Error) {
        throw new Error(`Failed to fetch assignments: ${error.message}`);
      }
      throw new Error('Failed to fetch assignments: Unknown error');
    }
  }
);

// Tool: list-assignment-submissions
server.tool(
  "list-assignment-submissions",
  "Fetch every student's submission status & comments for an assignment.",
  {
    courseId: z.string().describe("The ID of the course"),
    assignmentId: z.string().describe("The ID of the assignment")
  },
  async ({ courseId, assignmentId }) => {
    try {
      const response = await axiosInstance.get(
        `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions`
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response.data, null, 2)
          }
        ]
      };
    } catch (error: any) {
      console.error('Full error details:', error.response?.data || error);
      if (error.response?.status === 404) {
        throw new Error(`Assignment ${assignmentId} not found in course ${courseId}`);
      }
      if (error.response?.data?.errors) {
        throw new Error(`Failed to fetch assignment submissions: ${JSON.stringify(error.response.data.errors)}`);
      }
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
    // All grading fields optional
    posted_grade: z.string().optional(),
    score: z.number().optional(),
    rubric_assessment: z.any().optional(),
    comment: z.string().optional()
  },
  async ({ courseId, assignmentId, userId, posted_grade, score, rubric_assessment, comment }) => {
    try {
      const payload: any = {};
      if (posted_grade !== undefined) payload.posted_grade = posted_grade;
      if (score !== undefined) payload.score = score;
      if (rubric_assessment !== undefined) payload.rubric_assessment = rubric_assessment;
      if (comment !== undefined) payload.comment = { text_comment: comment };
      const response = await axiosInstance.put(
        `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}`,
        payload
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response.data, null, 2)
          }
        ]
      };
    } catch (error: any) {
      console.error('Full error details:', error.response?.data || error);
      if (error.response?.status === 404) {
        throw new Error(`Submission for user ${userId} on assignment ${assignmentId} not found in course ${courseId}`);
      }
      if (error.response?.data?.errors) {
        throw new Error(`Failed to grade submission: ${JSON.stringify(error.response.data.errors)}`);
      }
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
  async ({ courseId, assignmentId, userId, comment }) => {
    try {
      const response = await axiosInstance.put(
        `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}/comments`,
        { comment: { text_comment: comment } }
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response.data, null, 2)
          }
        ]
      };
    } catch (error: any) {
      console.error('Full error details:', error.response?.data || error);
      if (error.response?.status === 404) {
        throw new Error(`Submission for user ${userId} on assignment ${assignmentId} not found in course ${courseId}`);
      }
      if (error.response?.data?.errors) {
        throw new Error(`Failed to post submission comment: ${JSON.stringify(error.response.data.errors)}`);
      }
      if (error instanceof Error) {
        throw new Error(`Failed to post submission comment: ${error.message}`);
      }
      throw new Error('Failed to post submission comment: Unknown error');
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
  async ({ courseId, assignmentId, rubricId }) => {
    try {
      const response = await axiosInstance.put(
        `/api/v1/courses/${courseId}/assignments/${assignmentId}?rubric_id=${encodeURIComponent(rubricId)}`
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response.data, null, 2)
          }
        ]
      };
    } catch (error: any) {
      console.error('Full error details:', error.response?.data || error);
      if (error.response?.status === 404) {
        throw new Error(`Assignment ${assignmentId} or rubric ${rubricId} not found in course ${courseId}`);
      }
      if (error.response?.data?.errors) {
        throw new Error(`Failed to attach rubric: ${JSON.stringify(error.response.data.errors)}`);
      }
      if (error instanceof Error) {
        throw new Error(`Failed to attach rubric: ${error.message}`);
      }
      throw new Error('Failed to attach rubric: Unknown error');
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
  async ({ courseId, assignmentId }) => {
    try {
      const response = await axiosInstance.get(
        `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions`,
        { params: { 'include[]': 'rubric_assessment' } }
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response.data, null, 2)
          }
        ]
      };
    } catch (error: any) {
      console.error('Full error details:', error.response?.data || error);
      if (error.response?.status === 404) {
        throw new Error(`Assignment ${assignmentId} not found in course ${courseId}`);
      }
      if (error.response?.data?.errors) {
        throw new Error(`Failed to fetch rubric assessments: ${JSON.stringify(error.response.data.errors)}`);
      }
      if (error instanceof Error) {
        throw new Error(`Failed to fetch rubric assessments: ${error.message}`);
      }
      throw new Error('Failed to fetch rubric assessments: Unknown error');
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
    includeComments: z.boolean().default(true).describe("Whether to include submission comments")
  },
  async ({ courseId, assignmentId, sectionId, includeComments = true }) => {
    let submissions = [];
    let page = 1;
    let hasMore = true;

    try {
      // First verify the section exists in the course
      await axiosInstance.get(
        `/api/v1/courses/${courseId}/sections/${sectionId}`
      );

      // Fetch submissions for the section
      while (hasMore) {
        const response = await axiosInstance.get(
          `/api/v1/sections/${sectionId}/assignments/${assignmentId}/submissions`,
          {
            params: {
              per_page: 100,
              page: page,
              include: [
                'user',
                'submission_comments',
                'assignment'
              ]
            }
          }
        );

        const pageSubmissions = response.data;
        submissions.push(...pageSubmissions);

        hasMore = pageSubmissions.length === 100;
        page += 1;
      }

      // Format the submissions list
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

          // Add submission comments if requested
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
      console.error('Full error details:', error.response?.data || error);
      if (error.response?.status === 404) {
        throw new Error(`Section ${sectionId} not found in course ${courseId}`);
      }
      if (error.response?.data?.errors) {
        throw new Error(`Failed to fetch section submissions: ${JSON.stringify(error.response.data.errors)}`);
      }
      if (error instanceof Error) {
        throw new Error(`Failed to fetch section submissions: ${error.message}`);
      }
      throw new Error('Failed to fetch section submissions: Unknown error');
    }
  }
);

// Tool: list-sections
server.tool(
  "list-sections",
  "Get a list of all sections in a course",
  {
    courseId: z.string().describe("The ID of the course"),
    includeStudentCount: z.boolean().default(false).describe("Whether to include the number of students in each section")
  },
  async ({ courseId, includeStudentCount = false }) => {
    let sections = [];
    let page = 1;
    let hasMore = true;

    try {
      // Fetch all pages of sections
      while (hasMore) {
        const response = await axiosInstance.get(
          `/api/v1/courses/${courseId}/sections`,
          {
            params: {
              per_page: 100,
              page: page,
              include: includeStudentCount ? ['total_students'] : []
            }
          }
        );

        const pageSections = response.data;
        sections.push(...pageSections);

        hasMore = pageSections.length === 100;
        page += 1;
      }

      // Format the sections list
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
      console.error('Full error details:', error.response?.data || error);
      if (error.response?.status === 404) {
        throw new Error(`Course ${courseId} not found`);
      }
      if (error.response?.data?.errors) {
        throw new Error(`Failed to fetch sections: ${JSON.stringify(error.response.data.errors)}`);
      }
      if (error instanceof Error) {
        throw new Error(`Failed to fetch sections: ${error.message}`);
      }
      throw new Error('Failed to fetch sections: Unknown error');
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
  async ({ courseId, assignmentId, includePointDistribution = true }) => {
    try {
      // First get the assignment details with rubric
      const assignmentResponse = await axiosInstance.get(
        `/api/v1/courses/${courseId}/assignments/${assignmentId}`,
        {
          params: {
            include: ['rubric']
          }
        }
      );

      if (!assignmentResponse.data.rubric) {
        throw new Error('No rubric found for this assignment');
      }

      // Get all submissions with rubric assessments
      const submissions = await fetchAllPages(
        `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions`,
        {
          params: {
            include: ['rubric_assessment'],
            per_page: 100
          }
        }
      );

      // Calculate statistics for each rubric criterion
      const rubricStats = assignmentResponse.data.rubric.map((criterion: any): RubricStat => {
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
          // Create point distribution
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

      // Format the output
      const formattedStats = [
        'Overall Statistics:',
        `Total Submissions: ${overallStats.total_submissions}`,
        `Submissions with Assessment: ${overallStats.submissions_with_assessment}`,
        `Average Score: ${overallStats.overall_average}`,
        `Median Score: ${overallStats.overall_median}`,
        `Min Score: ${overallStats.overall_min}`,
        `Max Score: ${overallStats.overall_max}`,
        '\nCriterion Statistics:',
        ...rubricStats.map((stat: RubricStat) => {
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
      console.error('Full error details:', error.response?.data || error);
      if (error.response?.status === 404) {
        throw new Error(`Assignment ${assignmentId} not found in course ${courseId}`);
      }
      if (error.response?.data?.errors) {
        throw new Error(`Failed to fetch rubric statistics: ${JSON.stringify(error.response.data.errors)}`);
      }
      throw new Error(`Failed to fetch rubric statistics: ${error.message}`);
    }
  }
);

// Register the prompt for analyzing rubric statistics
server.prompt(
  "analyze-rubric-statistics",
  "Analyze rubric statistics for formative assignments in a course",
  {
    courseName: z.string().describe("The name of the course to analyze")
  },
  ({ courseName }) => {
    const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
    
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please analyze the rubric statistics for the course "${courseName}". Follow these steps:

1. First, use the list-courses tool to find the course ID for "${courseName}".

2. Then, use the list-assignments tool to get all assignments for this course.

3. For each formative assignment that has a due date before ${today}:
   - Use the get-rubric-statistics tool to get detailed statistics
   - Include the point distribution to create visualizations
   - Skip assignments with future due dates (after ${today})

4. Create and analyze two comprehensive visualizations that show all assignments together:
   a) Grouped Stacked Bar Chart:
      - X-axis: Criteria names
      - Y-axis: Percentage of students
      - Groups: One group of stacked bars per assignment
      - Bars: Stacked to show score distribution (0-4 points)
      - Colors: Consistent colors across assignments for each point value
      - Legend: Include both assignment names and point values
      
   b) Grouped Bar Chart:
      - X-axis: Criteria names
      - Y-axis: Average score
      - Groups: One bar per assignment for each criterion
      - Colors: Different color for each assignment
      - Include error bars showing standard deviation if available

5. Provide a summary of key insights based on:
   - Score distributions across criteria and assignments
   - Progression or patterns between assignments
   - Common areas of strength or difficulty across assignments
   - Notable trends or changes between assignments
   - Specific criteria that show consistent or varying performance

Please ensure all visualizations are clearly labeled with:
- Descriptive title (including analysis date: ${today})
- Axis labels
- Legend showing assignments and score levels
- Clear distinction between assignments
- Percentage or count indicators where appropriate`
          }
        }
      ]
    };
  }
);

// Tool: list-modules
server.tool(
  "list-modules",
  "Return all modules in a course (optionally inline items).",
  {
    courseId: z.string().describe("The ID of the course"),
    includeItems: z.boolean().default(false).describe("Whether to include inline items for each module")
  },
  async ({ courseId, includeItems }) => {
    let modules = [];
    let page = 1;
    let hasMore = true;
    try {
      while (hasMore) {
        const response = await axiosInstance.get(
          `/api/v1/courses/${courseId}/modules`,
          {
            params: {
              per_page: 100,
              page: page,
              ...(includeItems ? { 'include[]': 'items' } : {})
            }
          }
        );
        const pageModules = response.data;
        modules.push(...pageModules);
        hasMore = pageModules.length === 100;
        page += 1;
      }
      const formatted = modules.map((mod: any) => {
        const lines = [
          `Module: ${mod.name}`,
          `ID: ${mod.id}`,
          `Position: ${mod.position}`,
          `Published: ${mod.published ? 'Yes' : 'No'}`
        ];
        if (includeItems && mod.items) {
          lines.push('Items:');
          mod.items.forEach((item: any) => {
            lines.push(`  - [${item.type}] ${item.title || item.page_url || item.url || 'Untitled'} (ID: ${item.id})`);
          });
        }
        lines.push('---');
        return lines.join('\n');
      }).join('\n');
      return {
        content: [
          {
            type: "text",
            text: modules.length > 0 ? `Modules in course ${courseId}:\n\n${formatted}` : "No modules found in this course."
          }
        ]
      };
    } catch (error: any) {
      console.error('Full error details:', error.response?.data || error);
      if (error.response?.status === 404) {
        throw new Error(`Course ${courseId} not found`);
      }
      if (error.response?.data?.errors) {
        throw new Error(`Failed to fetch modules: ${JSON.stringify(error.response.data.errors)}`);
      }
      if (error instanceof Error) {
        throw new Error(`Failed to fetch modules: ${error.message}`);
      }
      throw new Error('Failed to fetch modules: Unknown error');
    }
  }
);

// Tool: list-module-items
server.tool(
  "list-module-items",
  "Given a module ID, list its items (pages, quizzes, files, etc).",
  {
    courseId: z.string().describe("The ID of the course"),
    moduleId: z.string().describe("The ID of the module")
  },
  async ({ courseId, moduleId }) => {
    let items = [];
    let page = 1;
    let hasMore = true;
    try {
      while (hasMore) {
        const response = await axiosInstance.get(
          `/api/v1/courses/${courseId}/modules/${moduleId}/items`,
          {
            params: {
              per_page: 100,
              page: page
            }
          }
        );
        const pageItems = response.data;
        items.push(...pageItems);
        hasMore = pageItems.length === 100;
        page += 1;
      }
      const formatted = items.map((item: any) => {
        return [
          `Type: ${item.type}`,
          `Title: ${item.title || item.page_url || item.url || 'Untitled'}`,
          `ID: ${item.id}`,
          `Position: ${item.position}`,
          `Published: ${item.published ? 'Yes' : 'No'}`,
          '---'
        ].join('\n');
      }).join('\n');
      return {
        content: [
          {
            type: "text",
            text: items.length > 0 ? `Items in module ${moduleId} (course ${courseId}):\n\n${formatted}` : "No items found in this module."
          }
        ]
      };
    } catch (error: any) {
      console.error('Full error details:', error.response?.data || error);
      if (error.response?.status === 404) {
        throw new Error(`Module ${moduleId} not found in course ${courseId}`);
      }
      if (error.response?.data?.errors) {
        throw new Error(`Failed to fetch module items: ${JSON.stringify(error.response.data.errors)}`);
      }
      if (error instanceof Error) {
        throw new Error(`Failed to fetch module items: ${error.message}`);
      }
      throw new Error('Failed to fetch module items: Unknown error');
    }
  }
);

// Tool: toggle-module-publish
server.tool(
  "toggle-module-publish",
  "Publish/unpublish a module (toggles the current published state).",
  {
    courseId: z.string().describe("The ID of the course"),
    moduleId: z.string().describe("The ID of the module")
  },
  async ({ courseId, moduleId }) => {
    try {
      // Get current module state
      const getResp = await axiosInstance.get(`/api/v1/courses/${courseId}/modules/${moduleId}`);
      const current = getResp.data;
      const newPublished = !current.published;
      // Toggle published state
      await axiosInstance.put(
        `/api/v1/courses/${courseId}/modules/${moduleId}`,
        { published: newPublished }
      );
      return {
        content: [
          {
            type: "text",
            text: `Module ${moduleId} in course ${courseId} is now ${newPublished ? 'published' : 'unpublished'}.`
          }
        ]
      };
    } catch (error: any) {
      console.error('Full error details:', error.response?.data || error);
      if (error.response?.status === 404) {
        throw new Error(`Module ${moduleId} not found in course ${courseId}`);
      }
      if (error.response?.data?.errors) {
        throw new Error(`Failed to toggle module publish: ${JSON.stringify(error.response.data.errors)}`);
      }
      if (error instanceof Error) {
        throw new Error(`Failed to toggle module publish: ${error.message}`);
      }
      throw new Error('Failed to toggle module publish: Unknown error');
    }
  }
);

// Tool: list-pages
server.tool(
  "list-pages",
  "List all pages in a course (by URL slug).",
  {
    courseId: z.string().describe("The ID of the course")
  },
  async ({ courseId }) => {
    let pages = [];
    let page = 1;
    let hasMore = true;
    try {
      while (hasMore) {
        const response = await axiosInstance.get(
          `/api/v1/courses/${courseId}/pages`,
          {
            params: {
              per_page: 100,
              page: page
            }
          }
        );
        const pagePages = response.data;
        pages.push(...pagePages);
        hasMore = pagePages.length === 100;
        page += 1;
      }
      const formatted = pages.map((p: any) => [
        `Title: ${p.title}`,
        `URL Slug: ${p.url}`,
        `ID: ${p.page_id}`,
        `Published: ${p.published ? 'Yes' : 'No'}`,
        '---'
      ].join('\n')).join('\n');
      return {
        content: [
          {
            type: "text",
            text: pages.length > 0 ? `Pages in course ${courseId}:\n\n${formatted}` : "No pages found in this course."
          }
        ]
      };
    } catch (error: any) {
      console.error('Full error details:', error.response?.data || error);
      if (error.response?.status === 404) {
        throw new Error(`Course ${courseId} not found`);
      }
      if (error.response?.data?.errors) {
        throw new Error(`Failed to fetch pages: ${JSON.stringify(error.response.data.errors)}`);
      }
      if (error instanceof Error) {
        throw new Error(`Failed to fetch pages: ${error.message}`);
      }
      throw new Error('Failed to fetch pages: Unknown error');
    }
  }
);

// Tool: get-page-content
server.tool(
  "get-page-content",
  "Get the content of a specific page by URL slug.",
  {
    courseId: z.string().describe("The ID of the course"),
    pageUrl: z.string().describe("The page's URL slug (e.g., 'syllabus')")
  },
  async ({ courseId, pageUrl }) => {
    try {
      const response = await axiosInstance.get(
        `/api/v1/courses/${courseId}/pages/${encodeURIComponent(pageUrl)}`
      );
      const page = response.data;
      return {
        content: [
          {
            type: "text",
            text: [
              `Title: ${page.title}`,
              `URL Slug: ${page.url}`,
              `ID: ${page.page_id}`,
              `Published: ${page.published ? 'Yes' : 'No'}`,
              `Updated At: ${page.updated_at}`,
              '',
              'Body (HTML):',
              page.body || '[No content]'
            ].join('\n')
          }
        ]
      };
    } catch (error: any) {
      console.error('Full error details:', error.response?.data || error);
      if (error.response?.status === 404) {
        throw new Error(`Page '${pageUrl}' not found in course ${courseId}`);
      }
      if (error.response?.data?.errors) {
        throw new Error(`Failed to fetch page content: ${JSON.stringify(error.response.data.errors)}`);
      }
      if (error instanceof Error) {
        throw new Error(`Failed to fetch page content: ${error.message}`);
      }
      throw new Error('Failed to fetch page content: Unknown error');
    }
  }
);

// Tool: update-page-content
server.tool(
  "update-page-content",
  "Update (or create) a page by URL slug.",
  {
    courseId: z.string().describe("The ID of the course"),
    pageUrl: z.string().describe("The page's URL slug (e.g., 'syllabus')"),
    title: z.string().optional().describe("The new title for the page (optional)"),
    body: z.string().optional().describe("The new HTML body for the page (optional)"),
    editingRoles: z.string().optional().describe("Comma-separated roles allowed to edit (optional)")
  },
  async ({ courseId, pageUrl, title, body, editingRoles }) => {
    try {
      const wiki_page: any = {};
      if (title !== undefined) wiki_page.title = title;
      if (body !== undefined) wiki_page.body = body;
      if (editingRoles !== undefined) wiki_page.editing_roles = editingRoles;
      const response = await axiosInstance.put(
        `/api/v1/courses/${courseId}/pages/${encodeURIComponent(pageUrl)}`,
        { wiki_page }
      );
      const page = response.data;
      return {
        content: [
          {
            type: "text",
            text: [
              `Page '${page.url}' updated in course ${courseId}.`,
              `Title: ${page.title}`,
              `ID: ${page.page_id}`,
              `Published: ${page.published ? 'Yes' : 'No'}`,
              `Updated At: ${page.updated_at}`
            ].join('\n')
          }
        ]
      };
    } catch (error: any) {
      console.error('Full error details:', error.response?.data || error);
      if (error.response?.status === 404) {
        throw new Error(`Page '${pageUrl}' not found in course ${courseId}`);
      }
      if (error.response?.data?.errors) {
        throw new Error(`Failed to update page: ${JSON.stringify(error.response.data.errors)}`);
      }
      if (error instanceof Error) {
        throw new Error(`Failed to update page: ${error.message}`);
      }
      throw new Error('Failed to update page: Unknown error');
    }
  }
);

// Tool: list-page-revisions
server.tool(
  "list-page-revisions",
  "List all revisions for a page.",
  {
    courseId: z.string().describe("The ID of the course"),
    pageUrl: z.string().describe("The page's URL slug (e.g., 'syllabus')")
  },
  async ({ courseId, pageUrl }) => {
    try {
      const response = await axiosInstance.get(
        `/api/v1/courses/${courseId}/pages/${encodeURIComponent(pageUrl)}/revisions`
      );
      const revisions = response.data;
      const formatted = revisions.map((rev: any) => [
        `Revision ID: ${rev.id}`,
        `Updated At: ${rev.updated_at}`,
        `Edited By: ${rev.edited_by?.display_name || rev.edited_by_id || 'Unknown'}`,
        '---'
      ].join('\n')).join('\n');
      return {
        content: [
          {
            type: "text",
            text: revisions.length > 0 ? `Revisions for page '${pageUrl}' in course ${courseId}:\n\n${formatted}` : "No revisions found for this page."
          }
        ]
      };
    } catch (error: any) {
      console.error('Full error details:', error.response?.data || error);
      if (error.response?.status === 404) {
        throw new Error(`Page '${pageUrl}' not found in course ${courseId}`);
      }
      if (error.response?.data?.errors) {
        throw new Error(`Failed to fetch page revisions: ${JSON.stringify(error.response.data.errors)}`);
      }
      if (error instanceof Error) {
        throw new Error(`Failed to fetch page revisions: ${error.message}`);
      }
      throw new Error('Failed to fetch page revisions: Unknown error');
    }
  }
);

// Tool: revert-page-revision
server.tool(
  "revert-page-revision",
  "Revert a page to a previous revision.",
  {
    courseId: z.string().describe("The ID of the course"),
    pageUrl: z.string().describe("The page's URL slug (e.g., 'syllabus')"),
    revisionId: z.string().describe("The ID of the revision to revert to")
  },
  async ({ courseId, pageUrl, revisionId }) => {
    try {
      const response = await axiosInstance.post(
        `/api/v1/courses/${courseId}/pages/${encodeURIComponent(pageUrl)}/revisions/${revisionId}/revert`
      );
      const page = response.data;
      return {
        content: [
          {
            type: "text",
            text: [
              `Page '${pageUrl}' in course ${courseId} reverted to revision ${revisionId}.`,
              `Title: ${page.title}`,
              `ID: ${page.page_id}`,
              `Published: ${page.published ? 'Yes' : 'No'}`,
              `Updated At: ${page.updated_at}`
            ].join('\n')
          }
        ]
      };
    } catch (error: any) {
      console.error('Full error details:', error.response?.data || error);
      if (error.response?.status === 404) {
        throw new Error(`Page '${pageUrl}' or revision '${revisionId}' not found in course ${courseId}`);
      }
      if (error.response?.data?.errors) {
        throw new Error(`Failed to revert page revision: ${JSON.stringify(error.response.data.errors)}`);
      }
      if (error instanceof Error) {
        throw new Error(`Failed to revert page revision: ${error.message}`);
      }
      throw new Error('Failed to revert page revision: Unknown error');
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
  async ({ courseId, assignmentId }) => {
    try {
      const response = await axiosInstance.get(
        `/api/v1/courses/${courseId}/assignments/${assignmentId}`
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response.data, null, 2)
          }
        ]
      };
    } catch (error: any) {
      console.error('Full error details:', error.response?.data || error);
      if (error.response?.status === 404) {
        throw new Error(`Assignment ${assignmentId} not found in course ${courseId}`);
      }
      if (error.response?.data?.errors) {
        throw new Error(`Failed to fetch assignment: ${JSON.stringify(error.response.data.errors)}`);
      }
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
    // All Canvas assignment fields as optional
    name: z.string().optional(),
    description: z.string().optional(),
    due_at: z.string().optional(),
    points_possible: z.number().optional(),
    submission_types: z.array(z.string()).optional(),
    published: z.boolean().optional(),
    grading_type: z.string().optional(),
    assignment_group_id: z.number().optional(),
    // ...add more fields as needed
  },
  async (args) => {
    const { courseId, ...fields } = args;
    try {
      const response = await axiosInstance.post(
        `/api/v1/courses/${courseId}/assignments`,
        { assignment: fields }
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response.data, null, 2)
          }
        ]
      };
    } catch (error: any) {
      console.error('Full error details:', error.response?.data || error);
      if (error.response?.data?.errors) {
        throw new Error(`Failed to create assignment: ${JSON.stringify(error.response.data.errors)}`);
      }
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
    // All Canvas assignment fields as optional
    name: z.string().optional(),
    description: z.string().optional(),
    due_at: z.string().optional(),
    points_possible: z.number().optional(),
    submission_types: z.array(z.string()).optional(),
    published: z.boolean().optional(),
    grading_type: z.string().optional(),
    assignment_group_id: z.number().optional(),
    // ...add more fields as needed
  },
  async (args) => {
    const { courseId, assignmentId, ...fields } = args;
    try {
      const response = await axiosInstance.put(
        `/api/v1/courses/${courseId}/assignments/${assignmentId}`,
        { assignment: fields }
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response.data, null, 2)
          }
        ]
      };
    } catch (error: any) {
      console.error('Full error details:', error.response?.data || error);
      if (error.response?.status === 404) {
        throw new Error(`Assignment ${assignmentId} not found in course ${courseId}`);
      }
      if (error.response?.data?.errors) {
        throw new Error(`Failed to update assignment: ${JSON.stringify(error.response.data.errors)}`);
      }
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
  async ({ courseId, assignmentId }) => {
    try {
      const response = await axiosInstance.delete(
        `/api/v1/courses/${courseId}/assignments/${assignmentId}`
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response.data, null, 2)
          }
        ]
      };
    } catch (error: any) {
      console.error('Full error details:', error.response?.data || error);
      if (error.response?.status === 404) {
        throw new Error(`Assignment ${assignmentId} not found in course ${courseId}`);
      }
      if (error.response?.data?.errors) {
        throw new Error(`Failed to delete assignment: ${JSON.stringify(error.response.data.errors)}`);
      }
      if (error instanceof Error) {
        throw new Error(`Failed to delete assignment: ${error.message}`);
      }
      throw new Error('Failed to delete assignment: Unknown error');
    }
  }
);

// Tool: list-assignment-groups
server.tool(
  "list-assignment-groups",
  "List all assignment groups (buckets) in a course.",
  {
    courseId: z.string().describe("The ID of the course")
  },
  async ({ courseId }) => {
    try {
      const response = await axiosInstance.get(
        `/api/v1/courses/${courseId}/assignment_groups`
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response.data, null, 2)
          }
        ]
      };
    } catch (error: any) {
      console.error('Full error details:', error.response?.data || error);
      if (error.response?.status === 404) {
        throw new Error(`Course ${courseId} not found`);
      }
      if (error.response?.data?.errors) {
        throw new Error(`Failed to fetch assignment groups: ${JSON.stringify(error.response.data.errors)}`);
      }
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
  async (args) => {
    const { courseId, ...fields } = args;
    try {
      const response = await axiosInstance.post(
        `/api/v1/courses/${courseId}/assignment_groups`,
        { assignment_group: fields }
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response.data, null, 2)
          }
        ]
      };
    } catch (error: any) {
      console.error('Full error details:', error.response?.data || error);
      if (error.response?.data?.errors) {
        throw new Error(`Failed to create assignment group: ${JSON.stringify(error.response.data.errors)}`);
      }
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
  async ({ courseId, assignmentDates }) => {
    try {
      const response = await axiosInstance.put(
        `/api/v1/courses/${courseId}/assignments/bulk_update`,
        { assignment_dates: assignmentDates }
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response.data, null, 2)
          }
        ]
      };
    } catch (error: any) {
      console.error('Full error details:', error.response?.data || error);
      if (error.response?.data?.errors) {
        throw new Error(`Failed to bulk update assignment dates: ${JSON.stringify(error.response.data.errors)}`);
      }
      if (error instanceof Error) {
        throw new Error(`Failed to bulk update assignment dates: ${error.message}`);
      }
      throw new Error('Failed to bulk update assignment dates: Unknown error');
    }
  }
);

// Start the server
async function startServer() {
  try {
    console.error("Starting Canvas MCP Server...");
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Canvas MCP Server running on stdio");
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

startServer();