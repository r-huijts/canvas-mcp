# Canvas MCP Server

A Model Context Protocol (MCP) server that enables AI assistants like Claude to interact with Canvas LMS. This server provides tools for managing courses, announcements, rubrics, assignments, modules, pages, and student data through the Canvas API.

## Features

- List active courses and their details
- Post announcements to courses
- View course rubrics
- Get student enrollment information
- Access assignment details and submissions
- View student submission history and comments
- Analyze rubric statistics
- **Manage course modules and module items**
- **Manage course pages, including content, revisions, and rollbacks**

## Prerequisites

- Node.js (v16 or higher)
- A Canvas API token
- Canvas instance URL (defaults to "https://fhict.instructure.com")

## Installation

1. Clone this repository and install dependencies:
   ```bash
   git clone <repository-url>
   cd canvas-mcp
   npm install
   ```

2. Create a `.env` file in the project root:
   ```
   CANVAS_API_TOKEN=your_canvas_api_token_here
   CANVAS_BASE_URL=https://your-canvas-instance.instructure.com
   ```

3. Build the TypeScript project:
   ```bash
   npm run build
   ```

4. Start the server:
   ```bash
   npm start
   ```

## Claude Desktop Integration

1. Open Claude Desktop's configuration file:

   **MacOS**:
   ```bash
   code ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```

   **Windows**:
   ```bash
   code %AppData%\Claude\claude_desktop_config.json
   ```

2. Add the Canvas MCP server configuration:
   ```json
   {
     "mcpServers": {
       "canvas": {
         "command": "node",
         "args": [
           "/path/to/canvas-mcp/build/index.js"
         ],
         "env": {
           "CANVAS_API_TOKEN": "your_token_here",
           "CANVAS_BASE_URL": "https://your-canvas-instance.com"
         }
       }
     }
   }
   ```

3. Restart Claude Desktop to apply changes

## Available Tools

### list-courses
Lists all active courses for the authenticated user
- No required parameters
- Returns course names, IDs, and term information

### post-announcement
Posts an announcement to a specific course
- Required parameters:
  - courseId: string
  - title: string
  - message: string

### list-rubrics
Lists all rubrics for a specific course
- Required parameters:
  - courseId: string
- Returns rubric titles, IDs, and descriptions

### list-students
Gets a complete list of students enrolled in a course
- Required parameters:
  - courseId: string
- Optional parameters:
  - includeEmail: boolean (default: false)
- Returns student names, IDs, and optional email addresses

### list-assignments
Gets all assignments in a course with submission status
- Required parameters:
  - courseId: string
- Optional parameters:
  - studentId: string
  - includeSubmissionHistory: boolean (default: false)
- Returns assignment details and submission status

### list-assignment-submissions
Gets all student submissions for a specific assignment
- Required parameters:
  - courseId: string
  - assignmentId: string
- Optional parameters:
  - includeComments: boolean (default: true)
- Returns submission details, grades, and comments

### list-section-submissions
Gets all student submissions for a specific assignment filtered by section
- Required parameters:
  - courseId: string
  - assignmentId: string
  - sectionId: string
- Optional parameters:
  - includeComments: boolean (default: true)
- Returns submission details filtered by the specified section

### list-sections
Gets a list of all sections in a course
- Required parameters:
  - courseId: string
- Optional parameters:
  - includeStudentCount: boolean (default: false)
- Returns section details with optional student count

### post-submission-comment
Posts a comment on a student's assignment submission
- Required parameters:
  - courseId: string
  - assignmentId: string
  - studentId: string
  - comment: string
- Returns confirmation of the posted comment

### get-rubric-statistics
Gets statistics for rubric assessments on an assignment
- Required parameters:
  - courseId: string
  - assignmentId: string
- Optional parameters:
  - includePointDistribution: boolean (default: true)
- Returns detailed statistics about rubric assessment criteria

### list-modules
Lists all modules in a course, optionally including inline items
- Required parameters:
  - courseId: string
- Optional parameters:
  - includeItems: boolean (default: false)
- Returns module names, IDs, positions, published state, and optionally item summaries

### list-module-items
Lists all items in a specific module
- Required parameters:
  - courseId: string
  - moduleId: string
- Returns item type, title, ID, position, and published state

### toggle-module-publish
Toggles the published/unpublished state of a module
- Required parameters:
  - courseId: string
  - moduleId: string
- Returns confirmation of the new published state

### list-pages
Lists all pages in a course by URL slug
- Required parameters:
  - courseId: string
- Returns page titles, URL slugs, IDs, and published state

### get-page-content
Gets the content (HTML/body) of a specific page by URL slug
- Required parameters:
  - courseId: string
  - pageUrl: string (the page's URL slug, e.g. 'syllabus')
- Returns page title, slug, ID, published state, updated date, and HTML body

### update-page-content
Updates (or creates) a page by URL slug
- Required parameters:
  - courseId: string
  - pageUrl: string
- Optional parameters:
  - title: string
  - body: string (HTML)
  - editingRoles: string (comma-separated roles)
- Returns confirmation and updated page info

### list-page-revisions
Lists all revisions for a page
- Required parameters:
  - courseId: string
  - pageUrl: string
- Returns revision IDs, timestamps, and editor info

### revert-page-revision
Reverts a page to a previous revision
- Required parameters:
  - courseId: string
  - pageUrl: string
  - revisionId: string
- Returns confirmation and new page state

## Available Prompts

### analyze-rubric-statistics
Analyzes rubric statistics for formative assignments in a course and creates visualizations
- Required parameters:
  - courseName: string (The name of the course to analyze)
- Creates two comprehensive visualizations:
  1. Grouped stacked bar chart showing score distribution per criterion across all assignments
  2. Grouped bar chart showing average scores per criterion for all assignments
- Provides comparative analysis across assignments and criteria
- Includes progression analysis and trend identification

## Troubleshooting

### Common Issues

1. Server not appearing in Claude Desktop:
   - Verify configuration file syntax
   - Check file paths are absolute
   - Ensure Canvas API token is valid
   - Restart Claude Desktop

2. Connection errors:
   - Check Canvas API token permissions
   - Verify Canvas instance is accessible
   - Review Claude's MCP logs:
     ```bash
     # MacOS
     tail -f ~/Library/Logs/Claude/mcp*.log
     # Windows
     type %AppData%\Claude\Logs\mcp*.log
     ```

### Debug Logging
The server logs errors to stderr. These can be viewed in Claude Desktop's logs or redirected when running manually:
```bash
node build/index.js 2> debug.log
```

## Development

This MCP server uses the latest Model Context Protocol TypeScript SDK (v1.11.3+) with the new tool registration pattern. Each tool is registered with the server using the `server.tool()` method, which takes the following parameters:

1. Tool name (string)
2. Tool description (string)
3. Input schema (Zod schema or plain object)
4. Execute function (async function that implements the tool logic)

Here's an example of how a tool is registered:

```typescript
server.tool(
  "list-courses",
  "List all courses for the authenticated user",
  {},
  async () => {
    // Tool implementation...
    return {
      content: [
        {
          type: "text",
          text: "Tool response..."
        }
      ]
    };
  }
);
```

## Security Notes

1. API Token Security:
   - Never commit your Canvas API token to version control
   - Use environment variables or secure configuration
   - Regularly rotate your API tokens
   
2. Permissions:
   - Use tokens with minimum required permissions
   - Review Canvas API access logs periodically

## License

MIT License

Copyright (c) 2024

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.