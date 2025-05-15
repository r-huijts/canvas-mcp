import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as dotenv from "dotenv";
import { CanvasConfig, Course, Rubric } from './types.js';
import { CanvasClient } from './canvasClient.js';
import { registerCourseTools } from './tools/courses.js';
import { registerStudentTools } from './tools/students.js';
import { registerAssignmentTools } from './tools/assignments.js';
import { registerAssignmentGroupTools } from './tools/assignmentGroups.js';
import { registerModuleTools } from './tools/modules.js';
import { registerPageTools } from './tools/pages.js';
import { registerSectionTools } from './tools/sections.js';
import { registerSubmissionTools } from './tools/submissions.js';
import { registerRubricTools } from './tools/rubrics.js';

// Load environment variables
dotenv.config();

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

// Create the CanvasClient instance
const canvas = new CanvasClient(config.baseUrl, config.apiToken);

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

// Register course-related tools
registerCourseTools(server, canvas);
registerStudentTools(server, canvas);
registerAssignmentTools(server, canvas);
registerAssignmentGroupTools(server, canvas);
registerModuleTools(server, canvas);
registerPageTools(server, canvas);
registerSectionTools(server, canvas);
registerSubmissionTools(server, canvas);
registerRubricTools(server, canvas);

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