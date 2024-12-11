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
