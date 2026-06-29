# Canvas MCP Server

A Model Context Protocol (MCP) server that enables AI assistants like Claude to interact with Canvas LMS. This server provides tools for managing courses, announcements, rubrics, assignments, modules, pages, and student data through the Canvas API.

**🚀 Now available as a Claude Desktop Extension for one-click installation!**

## Features

- List active courses and their details
- Post announcements to courses
- View, create, update, and delete assignments and assignment groups
- Grade submissions and post feedback comments
- View course rubrics and rubric assessment statistics
- Attach rubrics to assignments
- Get student enrollment information
- Access assignment details and submissions, including file downloads
- View student submission history and comments
- **Manage course modules and module items**
- **Manage course pages, including content, revisions, and rollbacks**
- **Manage quizzes, including questions and question groups**
- **ETag-based response caching** — unchanged data is never re-fetched, reducing API load and token use

## Desktop Extension Benefits 🎯

The Canvas MCP server is now available as a **Claude Desktop Extension** for the ultimate user experience:

- **🎯 One-Click Installation**: No terminal commands, no manual configuration
- **🔒 Secure Configuration**: API tokens stored securely in your OS keychain
- **🔄 Automatic Updates**: Get new features and fixes automatically
- **📦 Zero Dependencies**: Everything bundled - no Node.js installation required
- **🌍 Cross-Platform**: Works seamlessly on macOS and Windows
- **🎨 Native UI**: Configure settings through Claude Desktop's beautiful interface

Perfect for educators who want powerful Canvas integration without the technical complexity!

## Student Data Privacy & Anonymization 🔒

This Canvas MCP server includes **privacy-first anonymization** for student data. By default, all student names and emails are anonymized to protect privacy, but you can request real data when needed using natural language.

### How It Works

**Default Behavior (Anonymous):**
- Student names become: `Student 1`, `Student 2`, etc.
- Student emails become: `student1@example.com`, `student2@example.com`
- Same student always gets the same pseudonym across all API calls
- Teacher/admin names are **never anonymized** (preserved in comments)

**Natural Language Control:**
You can easily switch to real data by asking for it naturally:

```
❌ Anonymous (default):
"List all students in course 123"
→ Returns: Student 1, Student 2, student1@example.com

✅ Non-anonymous:
"List all students in course 123, but show their actual names and emails"
"Get assignment submissions with real student names"  
"Show me student data with actual identities"
→ Returns: John Smith, Jane Doe, john.smith@university.edu
```

### Affected Tools

The following tools support anonymization control:
- `list-students` - Student enrollment data
- `list-assignments` - When including student submission data  
- `list-assignment-submissions` - All submission data
- `list-section-submissions` - Section-filtered submissions
- `list-rubric-assessments` - Rubric assessment data

### Privacy Features

🔒 **Privacy by Default**: All student data is anonymized unless explicitly requested otherwise  
🗣️ **Natural Language**: Just ask for "actual names" when you need them  
👨‍🏫 **Teacher Protection**: Teacher/admin names are never anonymized  
🔄 **Consistent Mapping**: Same student gets same pseudonym across all calls  
🎯 **Selective**: Only anonymizes student data, preserves all other information  

### Why Teachers/Admins Aren't Anonymized

The anonymization system specifically targets **student privacy** while preserving educational context:

**🎓 Educational Rationale:**
- **Students are the protected population** - They're the vulnerable party whose privacy needs protection
- **Teacher feedback context matters** - Knowing which instructor provided feedback is pedagogically valuable
- **Staff accountability** - Teachers and admins are professional staff, not students requiring privacy protection

**📝 Practical Examples:**
```
Assignment Comments (with anonymization enabled):
✅ "Excellent analysis of the data trends! - Prof. Johnson"
❌ "I found this section confusing - Student 1" 
❌ "Thanks for the feedback! - Student 2"
```

**🔍 Technical Implementation:**
- Comments include an `author.role` field (`'student'`, `'teacher'`, `'admin'`, `'ta'`)
- Only authors with `role === 'student'` get anonymized
- Staff roles preserve real names for educational context

This design ensures student privacy while maintaining the educational value of knowing which instructor provided specific feedback. If you need full anonymization including staff, you can modify the anonymizer logic or request this as a feature enhancement.

### Technical Implementation

Each tool that handles student data includes an `anonymous` parameter:
- **Default**: `anonymous: true` (privacy-first)
- **Override**: Claude automatically sets `anonymous: false` when you request real names
- **Preserved**: All functional IDs and non-personal data remain unchanged

Example of how Claude interprets your requests:
- "with their actual names" → `anonymous: false`
- "show real emails" → `anonymous: false`  
- "anonymized" → `anonymous: true` (default anyway)
- "hide student identities" → `anonymous: true`

## Prerequisites

- Node.js (v16 or higher)
- A Canvas API token
- Canvas instance URL (defaults to "https://fhict.instructure.com")

## Installation

### Option 1: Desktop Extension (Easiest) 🚀

**NEW!** One-click installation with Claude Desktop Extensions:

1. **Download** the latest extension: [canvas-mcp-1.0.8.mcpb](https://github.com/r-huijts/canvas-mcp/releases/latest)
2. **Double-click** the `.mcpb` file to open with Claude Desktop
3. **Click "Install"** - that's it!
4. **Configure** your Canvas API token and base URL through the Claude Desktop UI

**Benefits:**
- ✅ **One-click installation** - no terminal required
- ✅ **Automatic updates** when new versions are available
- ✅ **Secure configuration** - API tokens stored in OS keychain
- ✅ **No dependencies** - everything bundled in the extension
- ✅ **Cross-platform** - works on macOS and Windows

### Option 2: NPM Package (Recommended)

The easiest way to use this MCP server is via npm:

```bash
npm install -g @r-huijts/canvas-mcp
```

Or use directly with npx (no installation required):

```bash
npx @r-huijts/canvas-mcp
```

### Option 3: From Source

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

   ### For NPM Package Installation (Recommended):
   ```json
   {
     "mcpServers": {
       "canvas": {
         "command": "npx",
         "args": [
           "-y",
           "@r-huijts/canvas-mcp"
         ],
         "env": {
           "CANVAS_API_TOKEN": "your_token_here",
           "CANVAS_BASE_URL": "https://your-canvas-instance.com"
         }
       }
     }
   }
   ```

   ### For Source Installation:
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

### Installation Notes

**Benefits of NPM Package Installation:**
- ✅ No need to clone/build source code
- ✅ Automatic updates available via npm
- ✅ Simpler configuration
- ✅ Works across different operating systems
- ✅ The `-y` flag automatically accepts package installation prompts

**Troubleshooting NPX Issues:**
- If you encounter permission issues, try running Claude Desktop as administrator (Windows) or with sudo (macOS)
- On Windows, ensure your PATH includes npm/npx executables
- For corporate networks, you may need to configure npm proxy settings

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

### get-rubric-statistics
Gets statistics for rubric assessments on an assignment
- Required parameters:
  - courseId: string
  - assignmentId: string
- Optional parameters:
  - includePointDistribution: boolean (default: true)
- Returns overall and per-criterion statistics including average, median, min, max, and score distribution

### list-rubric-assessments
Lists all rubric assessments for an assignment
- Required parameters:
  - courseId: string
  - assignmentId: string
- Optional parameters:
  - anonymous: boolean (default: true)
- Returns per-submission rubric scores and criteria ratings

### attach-rubric-to-assignment
Attaches an existing rubric to an assignment
- Required parameters:
  - courseId: string
  - assignmentId: string
  - rubricId: string

### list-students
Gets a complete list of students enrolled in a course
- Required parameters:
  - courseId: string
- Optional parameters:
  - includeEmail: boolean (default: false)
  - anonymous: boolean (default: true) - Whether to anonymize student names/emails
- Returns student names, IDs, and optional email addresses
- **Privacy**: Student data is anonymized by default (use "with actual names" to override)

### list-assignments
Gets all assignments in a course with submission status
- Required parameters:
  - courseId: string
- Optional parameters:
  - studentId: string
  - includeSubmissionHistory: boolean (default: false)
  - anonymous: boolean (default: true) - Whether to anonymize student data in submissions
- Returns assignment details and submission status
- **Privacy**: Student submission data is anonymized by default

### get-assignment
Fetches metadata for a single assignment
- Required parameters:
  - courseId: string
  - assignmentId: string
- Returns due date, points, grading type, submission types, rubric presence, and publish state

### create-assignment
Creates a new assignment in a course
- Required parameters:
  - courseId: string
- Optional parameters:
  - name, description, due_at, points_possible, submission_types, published, grading_type, assignment_group_id

### update-assignment
Updates an existing assignment
- Required parameters:
  - courseId: string
  - assignmentId: string
- Optional parameters: same as create-assignment

### delete-assignment
Deletes (archives) an assignment from a course
- Required parameters:
  - courseId: string
  - assignmentId: string

### list-assignment-groups
Lists all assignment groups (grade buckets) in a course
- Required parameters:
  - courseId: string
- Returns group name, ID, position, weight, and drop rules

### create-assignment-group
Creates a new assignment group in a course
- Required parameters:
  - courseId: string
- Optional parameters:
  - name, position, group_weight, sis_source_id, rules

### bulk-update-assignment-dates
Updates due/unlock/lock dates for multiple assignments in one call
- Required parameters:
  - courseId: string
  - assignmentDates: array of `{ assignment_id, due_at?, unlock_at?, lock_at? }`

### grade-submission
Writes a score, grade, rubric assessment, or comment for a student's submission
- Required parameters:
  - courseId: string
  - assignmentId: string
  - userId: string
- Optional parameters:
  - posted_grade, score, rubric_assessment, comment

### list-assignment-submissions
Gets all student submissions for a specific assignment
- Required parameters:
  - courseId: string
  - assignmentId: string
- Optional parameters:
  - anonymous: boolean (default: true) - Whether to anonymize student names/emails
- Returns submission details, grades, and comments
- **Privacy**: Student data is anonymized by default

### get-submission-documents
Retrieves a student's submission with attachment metadata and optional file content
- Required parameters:
  - courseId: string
  - assignmentId: string
  - userId: string
- Optional parameters:
  - downloadFiles: boolean (default: false)
  - anonymous: boolean (default: true)

### get-submission-file-info
Returns metadata for a specific file attached to a submission
- Required parameters:
  - fileId: string

### download-submission-file
Downloads a submission file as text or base64
- Required parameters:
  - fileId: string
- Optional parameters:
  - forceBase64: boolean (default: false)

### list-section-submissions
Gets all student submissions for a specific assignment filtered by section
- Required parameters:
  - courseId: string
  - assignmentId: string
  - sectionId: string
- Optional parameters:
  - includeComments: boolean (default: true)
  - anonymous: boolean (default: true) - Whether to anonymize student names/emails
- Returns submission details filtered by the specified section
- **Privacy**: Student data is anonymized by default

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

### create-module
Creates a new module in a course
- Required parameters:
  - courseId: string
  - name: string
- Optional parameters:
  - position: number (1-based)
  - unlock_at: string (ISO 8601 date)
  - require_sequential_progress: boolean
  - prerequisite_module_ids: string[]
  - publish_final_grade: boolean
- Returns the created module's ID, name, position, and published state

### update-module
Updates an existing module's properties
- Required parameters:
  - courseId: string
  - moduleId: string
- Optional parameters:
  - name, position, unlock_at, require_sequential_progress, prerequisite_module_ids, publish_final_grade, published
- Returns the updated module's ID, name, position, and published state

### delete-module
Permanently deletes a module and all its items from a course
- Required parameters:
  - courseId: string
  - moduleId: string
- Returns confirmation of deletion

### get-module-item
Gets details for a single module item
- Required parameters:
  - courseId: string
  - moduleId: string
  - itemId: string
- Returns item ID, type, title, position, content_id, published state, indent, external_url, page_url, and completion requirement

### create-module-item
Adds a new item to a module
- Required parameters:
  - courseId: string
  - moduleId: string
  - type: one of File, Page, Discussion, Assignment, Quiz, SubHeader, ExternalUrl, ExternalTool
- Optional parameters:
  - content_id, title, position, indent, page_url, external_url, new_tab
  - completion_requirement_type: must_view | must_contribute | must_submit | must_mark_done
  - completion_requirement_min_score: number
- Returns the created item's ID, type, title, and position

### update-module-item
Updates an existing module item
- Required parameters:
  - courseId: string
  - moduleId: string
  - itemId: string
- Optional parameters:
  - title, position, indent, external_url, new_tab, published
  - move_to_module_id: string (moves the item to a different module)
  - completion_requirement_type, completion_requirement_min_score
- Returns the updated item's ID, type, title, position, and published state

### delete-module-item
Removes an item from a module
- Required parameters:
  - courseId: string
  - moduleId: string
  - itemId: string
- Returns confirmation of deletion

### list-eportfolios
Lists all ePortfolios belonging to a user
- Required parameters:
  - userId: string
- Returns ePortfolio ID, name, public flag, workflow state, and timestamps

### get-eportfolio
Gets details for a single ePortfolio
- Required parameters:
  - eportfolioId: string
- Returns ID, user_id, name, public flag, workflow state, spam status, and timestamps

### get-eportfolio-pages
Lists all pages in an ePortfolio
- Required parameters:
  - eportfolioId: string
- Returns page ID, eportfolio_id, position, name, content, and timestamps

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

### patch-page-content
Applies targeted edits to a page using find-and-replace or section-level instructions
- Required parameters:
  - courseId: string
  - pageUrl: string
  - instructions: string
- Returns the updated page body

### apply-page-changes
Applies a set of structured diffs to a page (bulk patch)
- Required parameters:
  - courseId: string
  - pageUrl: string
  - changes: array of `{ find, replace }` pairs

### generate-styleguide
Generates a course styleguide page from existing page content
- Required parameters:
  - courseId: string
- Analyses existing pages and writes a `styleguide` page capturing fonts, colours, and layout conventions

### get-styleguide
Retrieves the styleguide page for a course
- Required parameters:
  - courseId: string

### Quizzes

#### list-quizzes
Lists all quizzes in a course
- Required parameters:
  - courseId: string
- Returns a list of quizzes with their details

#### get-quiz
Fetches metadata for a single quiz
- Required parameters:
  - courseId: string
  - quizId: string
- Returns the full quiz object

#### create-quiz
Creates a new quiz in a course
- Required parameters:
  - courseId: string
  - title: string
- Optional parameters:
  - description: string
  - quiz_type: "practice_quiz" | "assignment" | "graded_survey" | "survey"
  - due_at: string (ISO 8601 format)
  - points_possible: number
  - published: boolean
- Returns the newly created quiz object

#### update-quiz
Updates an existing quiz
- Required parameters:
  - courseId: string
  - quizId: string
- Optional parameters: same as create-quiz
- Returns the updated quiz object

#### delete-quiz
Deletes a quiz
- Required parameters:
  - courseId: string
  - quizId: string
- Returns confirmation of deletion

#### list-quiz-questions
Lists all questions for a quiz
- Required parameters:
  - courseId: string
  - quizId: string
- Returns a list of question objects

#### get-quiz-question
Fetches a single quiz question
- Required parameters:
  - courseId: string
  - quizId: string
  - questionId: string
- Returns the full question object

#### create-quiz-question
Creates a new question for a quiz
- Required parameters:
  - courseId: string
  - quizId: string
  - question: object (containing question_text, question_type, points_possible, etc.)
- Returns the newly created question object

#### update-quiz-question
Updates a quiz question
- Required parameters:
  - courseId: string
  - quizId: string
  - questionId: string
- Optional parameters:
  - question: object (with fields to update)
- Returns the updated question object

#### delete-quiz-question
Deletes a quiz question
- Required parameters:
  - courseId: string
  - quizId: string
  - questionId: string
- Returns confirmation of deletion

#### list-quiz-question-groups
Lists all question groups for a quiz
- Required parameters:
  - courseId: string
  - quizId: string
- Returns a list of question group objects

#### get-quiz-question-group
Fetches a single quiz question group
- Required parameters:
  - courseId: string
  - quizId: string
  - groupId: string
- Returns the full question group object

#### create-quiz-question-group
Creates a new question group for a quiz
- Required parameters:
  - courseId: string
  - quizId: string
  - quizGroup: object (containing name, pick_count, question_points)
- Returns the newly created question group object

#### update-quiz-question-group
Updates a quiz question group
- Required parameters:
  - courseId: string
  - quizId: string
  - groupId: string
- Optional parameters:
  - quizGroup: object (with fields to update)
- Returns the updated question group object

#### delete-quiz-question-group
Deletes a quiz question group
- Required parameters:
  - courseId: string
  - quizId: string
  - groupId: string
- Returns confirmation of deletion

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

## Performance & Caching

The server caches all stable Canvas API responses to avoid redundant fetches and reduce token consumption.

**How it works:**

- On the first request for a resource, the response body and any `ETag` or `Last-Modified` header are stored in memory.
- On subsequent requests for the same resource, the server sends a conditional GET (`If-None-Match` / `If-Modified-Since`). Canvas returns `304 Not Modified` with no body when the data hasn't changed — saving the bandwidth and tokens that would otherwise be spent re-sending identical content.
- If Canvas doesn't return validator headers, a 30-minute TTL is used as a fallback.
- Write operations (`POST`, `PUT`, `DELETE`) automatically evict affected cache entries so the next read always reflects the latest state.

**What is never cached:**
- Submission and grade data (`/submissions` endpoints) — always fetched live.

## Development

This MCP server uses the Model Context Protocol TypeScript SDK (v1.29.0). Each tool is registered with `server.tool()` using a five-argument form that includes tool annotations, which hint to MCP clients whether a tool is read-only, destructive, or idempotent:

1. Tool name (string)
2. Tool description (string)
3. Input schema (Zod schema)
4. Tool annotations (`{ readOnlyHint?, destructiveHint?, idempotentHint? }`)
5. Execute function

```typescript
server.tool(
  "list-courses",
  "List all active courses for the authenticated user. Returns course name, ID, course code, and term.",
  {},
  { readOnlyHint: true },
  async () => {
    // Tool implementation...
    return {
      content: [{ type: "text", text: "..." }]
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