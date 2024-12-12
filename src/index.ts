import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import axios from 'axios';
import { CanvasConfig, Course, Rubric } from './types.js';

// Add this interface near the top of the file, with the other types
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

// Handles integration with Canvas LMS through Model Context Protocol
class CanvasServer {
  private server: Server;
  private config: CanvasConfig;
  private axiosInstance;

  constructor(config: CanvasConfig) {
    this.config = config;
    
    // Initialize server
    this.server = new Server(
      {
        name: "canvas-mcp",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize axios instance with base configuration
    this.axiosInstance = axios.create({
      baseURL: this.config.baseUrl,
      headers: {
        Authorization: `Bearer ${this.config.apiToken}`,
      },
    });

    // Set up request handlers
    this.setupRequestHandlers();
  }

  // Configures handlers for available tools and their execution
  private setupRequestHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "list-courses",
            description: "List all courses for the authenticated user",
            inputSchema: {
              type: "object",
              properties: {},
              required: [],
            },
          },
          {
            name: "post-announcement",
            description: "Post an announcement to a specific course",
            inputSchema: {
              type: "object",
              properties: {
                courseId: {
                  type: "string",
                  description: "The ID of the course",
                },
                title: {
                  type: "string",
                  description: "The title of the announcement",
                },
                message: {
                  type: "string",
                  description: "The content of the announcement",
                },
              },
              required: ["courseId", "title", "message"],
            },
          },
          {
            name: "list-rubrics",
            description: "List all rubrics for a specific course",
            inputSchema: {
              type: "object",
              properties: {
                courseId: {
                  type: "string",
                  description: "The ID of the course",
                },
              },
              required: ["courseId"],
            },
          },
          {
            name: "list-students",
            description: "Get a complete list of all students enrolled in a specific course",
            inputSchema: {
              type: "object",
              properties: {
                courseId: {
                  type: "string",
                  description: "The ID of the course",
                },
                includeEmail: {
                  type: "boolean",
                  description: "Whether to include student email addresses",
                  default: false
                }
              },
              required: ["courseId"],
            },
          },
          {
            name: "list-assignments",
            description: "Get a list of all assignments in a course with submission status for students",
            inputSchema: {
              type: "object",
              properties: {
                courseId: {
                  type: "string",
                  description: "The ID of the course"
                },
                studentId: {
                  type: "string",
                  description: "Optional: Get submission status for a specific student",
                  required: false
                },
                includeSubmissionHistory: {
                  type: "boolean",
                  description: "Whether to include submission history details",
                  default: false
                }
              },
              required: ["courseId"]
            }
          },
          {
            name: "list-assignment-submissions",
            description: "Get all student submissions and comments for a specific assignment",
            inputSchema: {
              type: "object",
              properties: {
                courseId: {
                  type: "string",
                  description: "The ID of the course"
                },
                assignmentId: {
                  type: "string",
                  description: "The ID of the assignment"
                },
                includeComments: {
                  type: "boolean",
                  description: "Whether to include submission comments",
                  default: true
                }
              },
              required: ["courseId", "assignmentId"]
            }
          },
          {
            name: "list-section-submissions",
            description: "Get all student submissions for a specific assignment filtered by section",
            inputSchema: {
              type: "object",
              properties: {
                courseId: {
                  type: "string",
                  description: "The ID of the course"
                },
                assignmentId: {
                  type: "string",
                  description: "The ID of the assignment"
                },
                sectionId: {
                  type: "string",
                  description: "The ID of the section"
                },
                includeComments: {
                  type: "boolean",
                  description: "Whether to include submission comments",
                  default: true
                }
              },
              required: ["courseId", "assignmentId", "sectionId"]
            }
          },
          {
            name: "list-sections",
            description: "Get a list of all sections in a course",
            inputSchema: {
              type: "object",
              properties: {
                courseId: {
                  type: "string",
                  description: "The ID of the course"
                },
                includeStudentCount: {
                  type: "boolean",
                  description: "Whether to include the number of students in each section",
                  default: false
                }
              },
              required: ["courseId"]
            }
          },
          {
            name: "post-submission-comment",
            description: "Post a comment on a student's assignment submission",
            inputSchema: {
              type: "object",
              properties: {
                courseId: {
                  type: "string",
                  description: "The ID of the course"
                },
                assignmentId: {
                  type: "string", 
                  description: "The ID of the assignment"
                },
                studentId: {
                  type: "string",
                  description: "The ID of the student"
                },
                comment: {
                  type: "string",
                  description: "The comment text to post"
                }
              },
              required: ["courseId", "assignmentId", "studentId", "comment"]
            }
          },
          {
            name: "get-rubric-statistics",
            description: "Get statistics for rubric assessments on an assignment",
            inputSchema: {
              type: "object",
              properties: {
                courseId: {
                  type: "string",
                  description: "The ID of the course"
                },
                assignmentId: {
                  type: "string",
                  description: "The ID of the assignment"
                },
                includePointDistribution: {
                  type: "boolean",
                  description: "Whether to include point distribution for each criterion",
                  default: true
                }
              },
              required: ["courseId", "assignmentId"]
            }
          },
        ],
      };
    });

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "list-courses":
            return await this.handleListCourses();
          case "post-announcement":
            return await this.handlePostAnnouncement(args);
          case "list-rubrics":
            return await this.handleListRubrics(args);
          case "list-students":
            return await this.handleListStudents(args);
          case "list-assignments":
            return await this.handleListAssignments(args);
          case "list-assignment-submissions":
            return await this.handleListAssignmentSubmissions(args);
          case "list-section-submissions":
            return await this.handleListSectionSubmissions(args);
          case "list-sections":
            return await this.handleListSections(args);
          case "post-submission-comment":
            return await this.handlePostSubmissionComment(args);
          case "get-rubric-statistics":
            return await this.handleGetRubricStatistics(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error: any) {
        console.error('Error executing tool:', error);
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error.message}`,
            },
          ],
        };
      }
    });
  }

  // Fetches and formats a list of all active courses from Canvas
  private async handleListCourses() {
    try {
      // Get all active courses with pagination
      const response = await this.axiosInstance.get('/api/v1/courses', {
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

  // Creates a new announcement in the specified course
  private async handlePostAnnouncement(args: any) {
    const { courseId, title, message } = args;

    try {
      await this.axiosInstance.post(
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

  // Retrieves all rubrics associated with the specified course
  private async handleListRubrics(args: any) {
    const { courseId } = args;

    try {
      const response = await this.axiosInstance.get(
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

  // Fetches a complete list of enrolled students for the specified course
  private async handleListStudents(args: any) {
    const { courseId, includeEmail = false } = args;
    const students = [];
    let page = 1;
    let hasMore = true;

    try {
      // Fetch all pages of students
      while (hasMore) {
        const response = await this.axiosInstance.get(
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

  // Gets all assignments for a course with optional student submission details
  private async handleListAssignments(args: any) {
    const { courseId, studentId, includeSubmissionHistory = false } = args;
    let assignments = [];
    let page = 1;
    let hasMore = true;

    try {
      // Fetch all pages of assignments with submission and comment data
      while (hasMore) {
        const response = await this.axiosInstance.get(
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

  // Retrieves all student submissions for a specific assignment
  private async handleListAssignmentSubmissions(args: any) {
    const { courseId, assignmentId, includeComments = true } = args;
    let submissions = [];
    let page = 1;
    let hasMore = true;

    try {
      while (hasMore) {
        const response = await this.axiosInstance.get(
          `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions`,
          {
            params: {
              per_page: 100,
              page: page,
              include: [
                'user',  // Include user information
                'submission_comments', // Include comments
                'assignment' // Include assignment details
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
              ? `Submissions for assignment ${assignmentId} in course ${courseId}:\n\n${formattedSubmissions}\n\nTotal submissions: ${submissions.length}`
              : "No submissions found for this assignment.",
          },
        ],
      };
    } catch (error: any) {
      console.error('Full error details:', error.response?.data || error);
      if (error.response?.data?.errors) {
        throw new Error(`Failed to fetch submissions: ${JSON.stringify(error.response.data.errors)}`);
      }
      if (error instanceof Error) {
        throw new Error(`Failed to fetch submissions: ${error.message}`);
      }
      throw new Error('Failed to fetch submissions: Unknown error');
    }
  }

  // Retrieves all student submissions for a specific assignment filtered by section
  private async handleListSectionSubmissions(args: any) {
    const { courseId, assignmentId, sectionId, includeComments = true } = args;
    let submissions = [];
    let page = 1;
    let hasMore = true;

    try {
      // First verify the section exists in the course
      await this.axiosInstance.get(
        `/api/v1/courses/${courseId}/sections/${sectionId}`
      );

      // Fetch submissions for the section
      while (hasMore) {
        const response = await this.axiosInstance.get(
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

  // Retrieves all student submissions for a specific assignment filtered by section
  private async handleListSections(args: any) {
    const { courseId, includeStudentCount = false } = args;
    let sections = [];
    let page = 1;
    let hasMore = true;

    try {
      // Fetch all pages of sections
      while (hasMore) {
        const response = await this.axiosInstance.get(
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

  // Posts a comment on a student's assignment submission
  private async handlePostSubmissionComment(args: any) {
    const { courseId, assignmentId, studentId, comment } = args;

    try {
      // Post the comment to the submission
      await this.axiosInstance.put(
        `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${studentId}/comments`,
        {
          comment: {
            text_comment: comment
          }
        }
      );

      return {
        content: [
          {
            type: "text",
            text: `Successfully posted comment for student ${studentId} on assignment ${assignmentId}`
          }
        ]
      };
    } catch (error: any) {
      console.error('Full error details:', error.response?.data || error);
      if (error.response?.status === 404) {
        throw new Error(`Could not find submission for student ${studentId} on assignment ${assignmentId} in course ${courseId}`);
      }
      if (error.response?.data?.errors) {
        throw new Error(`Failed to post comment: ${JSON.stringify(error.response.data.errors)}`);
      }
      if (error instanceof Error) {
        throw new Error(`Failed to post comment: ${error.message}`);
      }
      throw new Error('Failed to post comment: Unknown error');
    }
  }

  // Handles rubric statistics for an assignment
  private async handleGetRubricStatistics(args: any) {
    const { courseId, assignmentId, includePointDistribution = true } = args;

    try {
      // First get the assignment details with rubric
      const assignmentResponse = await this.axiosInstance.get(
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
      const submissions = await this.fetchAllPages(
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
          stats.median_score = this.calculateMedian(scores);
          stats.min_score = Math.min(...scores);
          stats.max_score = Math.max(...scores);
        }

        if (includePointDistribution) {
          // Create point distribution
          const distribution: { [key: number]: number } = {};
          scores.forEach((score: number) => {
            distribution[score] = (distribution[score] || 0) + 1;
          });
          (stats as any).point_distribution = distribution;
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
        overallStats.overall_median = this.calculateMedian(totalScores);
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

  // Helper method to calculate median
  private calculateMedian(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    
    const sorted = [...numbers].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return Number(((sorted[middle - 1] + sorted[middle]) / 2).toFixed(2));
    }
    return Number(sorted[middle].toFixed(2));
  }

  // Helper method to fetch all pages
  private async fetchAllPages(url: string, config: any): Promise<any[]> {
    let results: any[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.axiosInstance.get(url, {
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

  // Starts the server using stdio transport
  public async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Canvas MCP Server running on stdio");
  }
}

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

// Start the server
const server = new CanvasServer(config);
server.start().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});