import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import axios from 'axios';
class CanvasServer {
    server;
    config;
    axiosInstance;
    constructor(config) {
        this.config = config;
        // Initialize server
        this.server = new Server({
            name: "canvas-mcp",
            version: "1.0.0",
        }, {
            capabilities: {
                tools: {},
            },
        });
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
    setupRequestHandlers() {
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
                    default:
                        throw new Error(`Unknown tool: ${name}`);
                }
            }
            catch (error) {
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
    async handleListCourses() {
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
            const courses = response.data;
            // Filter and format the courses
            const formattedCourses = courses
                .filter(course => course.workflow_state === 'available')
                .map((course) => {
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
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to fetch courses: ${error.message}`);
            }
            throw new Error('Failed to fetch courses: Unknown error');
        }
    }
    async handlePostAnnouncement(args) {
        const { courseId, title, message } = args;
        try {
            await this.axiosInstance.post(`/api/v1/courses/${courseId}/discussion_topics`, {
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
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to post announcement: ${error.message}`);
            }
            throw new Error('Failed to post announcement: Unknown error');
        }
    }
    async handleListRubrics(args) {
        const { courseId } = args;
        try {
            const response = await this.axiosInstance.get(`/api/v1/courses/${courseId}/rubrics`);
            const rubrics = response.data;
            const formattedRubrics = rubrics.map((rubric) => `Rubric: ${rubric.title}\nID: ${rubric.id}\nDescription: ${rubric.description || 'No description'}\n---`).join('\n');
            return {
                content: [
                    {
                        type: "text",
                        text: formattedRubrics || "No rubrics found for this course",
                    },
                ],
            };
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to fetch rubrics: ${error.message}`);
            }
            throw new Error('Failed to fetch rubrics: Unknown error');
        }
    }
    async handleListStudents(args) {
        const { courseId, includeEmail = false } = args;
        const students = [];
        let page = 1;
        let hasMore = true;
        try {
            // Fetch all pages of students
            while (hasMore) {
                const response = await this.axiosInstance.get(`/api/v1/courses/${courseId}/users`, {
                    params: {
                        enrollment_type: ['student'], // Only get students
                        per_page: 100, // Maximum page size
                        page: page,
                        include: ['email', 'avatar_url'], // Added avatar_url to includes
                        enrollment_state: ['active', 'invited'] // Get both active and invited students
                    }
                });
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
                    `Avatar URL: ${student.avatar_url || 'N/A'}` // Added avatar URL
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
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to fetch students: ${error.message}`);
            }
            throw new Error('Failed to fetch students: Unknown error');
        }
    }
    async handleListAssignments(args) {
        const { courseId, studentId, includeSubmissionHistory = false } = args;
        let assignments = [];
        let page = 1;
        let hasMore = true;
        try {
            // Fetch all pages of assignments with submission and comment data
            while (hasMore) {
                const response = await this.axiosInstance.get(`/api/v1/courses/${courseId}/assignments`, {
                    params: {
                        per_page: 100,
                        page: page,
                        // Always include submission history when studentId is provided
                        include: studentId ? ['submission', 'submission_comments', 'submission_history'] : [],
                        student_ids: studentId ? [studentId] : undefined,
                        order_by: 'position',
                    }
                });
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
                            .filter((comment) => comment.author?.role === 'teacher')
                            .forEach((comment) => {
                            const date = new Date(comment.created_at).toLocaleString();
                            parts.push(`    [${date}] ${comment.comment}`);
                        });
                    }
                    else {
                        parts.push('  Teacher Comments: None');
                    }
                    // Enhanced submission history handling
                    if (includeSubmissionHistory && assignment.submission.versioned_submissions?.length > 0) {
                        parts.push('  Submission History:');
                        assignment.submission.versioned_submissions
                            .sort((a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime())
                            .forEach((version, index) => {
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
                }
                else {
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
        }
        catch (error) {
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
    async handleListAssignmentSubmissions(args) {
        const { courseId, assignmentId, includeComments = true } = args;
        let submissions = [];
        let page = 1;
        let hasMore = true;
        try {
            while (hasMore) {
                const response = await this.axiosInstance.get(`/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions`, {
                    params: {
                        per_page: 100,
                        page: page,
                        include: [
                            'user', // Include user information
                            'submission_comments', // Include comments
                            'assignment' // Include assignment details
                        ]
                    }
                });
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
                    submission.submission_comments.forEach((comment) => {
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
        }
        catch (error) {
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
    async start() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error("Canvas MCP Server running on stdio");
    }
}
// Read configuration from environment variables
const config = {
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
