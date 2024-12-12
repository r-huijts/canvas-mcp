# Canvas MCP Server

A Model Context Protocol (MCP) server that enables AI assistants like Claude to interact with Canvas LMS. This server provides tools for managing courses, announcements, rubrics, assignments, and student data through the Canvas API.

## Features

- List active courses and their details
- Post announcements to courses
- View course rubrics
- Get student enrollment information
- Access assignment details and submissions
- View student submission history and comments

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

2. Build the TypeScript project:
   ```bash
   npm run build
   ```

3. Configure your environment variables:
   ```bash
   # Create a .env file
   echo "CANVAS_API_TOKEN=your_token_here" > .env
   # Optional: Set custom Canvas URL
   echo "CANVAS_BASE_URL=https://your-canvas-instance.com" >> .env
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