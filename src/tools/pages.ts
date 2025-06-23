import { z } from "zod";
import { CanvasClient } from "../canvasClient.js";

// Generate comprehensive Canvas styleguide content
function generateCanvasStyleguide(includeExamples: boolean = true, customBranding?: string): string {
  return `
<div class="canvas-styleguide">
  <h1>🎨 Canvas Course Styleguide</h1>
  <p><em>Consistent design standards for all course pages</em></p>
  
  ${customBranding ? `<div class="alert alert-info"><strong>Custom Branding:</strong> ${customBranding}</div>` : ''}

  <h2>📋 Page Structure Standards</h2>
  <h3>Page Headers</h3>
  <ul>
    <li><strong>H1:</strong> Use for main page title only (one per page)</li>
    <li><strong>H2:</strong> Use for major sections</li>
    <li><strong>H3:</strong> Use for subsections</li>
    <li><strong>H4-H6:</strong> Use sparingly for deep hierarchy</li>
  </ul>

  <h2>🎯 Canvas-Specific Components</h2>
  
  <h3>Alert Boxes</h3>
  <div class="alert alert-info">
    <strong>Info Alert:</strong> Use for general information and tips
    <br><code>&lt;div class="alert alert-info"&gt;...&lt;/div&gt;</code>
  </div>
  
  <div class="alert alert-warning">
    <strong>Warning Alert:</strong> Use for important notices and deadlines
    <br><code>&lt;div class="alert alert-warning"&gt;...&lt;/div&gt;</code>
  </div>
  
  <div class="alert alert-danger">
    <strong>Danger Alert:</strong> Use for critical information and errors
    <br><code>&lt;div class="alert alert-danger"&gt;...&lt;/div&gt;</code>
  </div>

  <h3>Content Boxes</h3>
  <div style="border: 1px solid #ddd; padding: 15px; margin: 10px 0; background: #f8f9fa;">
    <strong>Content Box Example:</strong> Use for highlighting important content
    <br><code>&lt;div style="border: 1px solid #ddd; padding: 15px; margin: 10px 0; background: #f8f9fa;"&gt;...&lt;/div&gt;</code>
  </div>

  <h2>📝 Typography Standards</h2>
  <h3>Text Formatting</h3>
  <ul>
    <li><strong>Bold text:</strong> Use &lt;strong&gt; for important terms</li>
    <li><em>Italic text:</em> Use &lt;em&gt; for emphasis</li>
    <li><code>Code/Technical terms:</code> Use &lt;code&gt; for technical content</li>
  </ul>

  <h3>Lists</h3>
  <p><strong>Unordered Lists:</strong> Use for general items</p>
  <ul>
    <li>Item 1</li>
    <li>Item 2</li>
    <li>Item 3</li>
  </ul>

  <p><strong>Ordered Lists:</strong> Use for step-by-step instructions</p>
  <ol>
    <li>First step</li>
    <li>Second step</li>
    <li>Third step</li>
  </ol>

  <h2>🔗 Link Standards</h2>
  <ul>
    <li><a href="#" target="_blank">External links</a> should open in new tab (target="_blank")</li>
    <li><a href="#">Internal links</a> should open in same tab</li>
    <li>Use descriptive link text, avoid "click here"</li>
  </ul>

  <h2>📱 Responsive Design</h2>
  <p>Ensure all content is mobile-friendly:</p>
  <ul>
    <li>Use responsive tables or convert to lists on mobile</li>
    <li>Avoid fixed widths, use percentages</li>
    <li>Test on different screen sizes</li>
  </ul>

  <h2>♿ Accessibility Standards</h2>
  <ul>
    <li><strong>Alt text:</strong> All images must have descriptive alt attributes</li>
    <li><strong>Color contrast:</strong> Ensure sufficient contrast for text</li>
    <li><strong>Heading hierarchy:</strong> Use proper H1-H6 structure</li>
    <li><strong>Link context:</strong> Links should be meaningful out of context</li>
  </ul>

  <h2>📊 Tables</h2>
  <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
    <thead>
      <tr style="background-color: #f8f9fa;">
        <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Header 1</th>
        <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Header 2</th>
        <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Header 3</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">Data 1</td>
        <td style="border: 1px solid #ddd; padding: 8px;">Data 2</td>
        <td style="border: 1px solid #ddd; padding: 8px;">Data 3</td>
      </tr>
    </tbody>
  </table>

  <h2>🖼️ Images and Media</h2>
  <ul>
    <li>Always include alt text for accessibility</li>
    <li>Use appropriate file formats (JPG for photos, PNG for graphics)</li>
    <li>Optimize file sizes for web</li>
    <li>Consider responsive image sizing</li>
  </ul>

  <h2>🚀 Best Practices</h2>
  <ol>
    <li><strong>Consistency:</strong> Follow this guide for all pages</li>
    <li><strong>Clarity:</strong> Use clear, concise language</li>
    <li><strong>Navigation:</strong> Include clear page structure</li>
    <li><strong>Updates:</strong> Keep content current and accurate</li>
    <li><strong>Testing:</strong> Verify links and formatting regularly</li>
  </ol>

  <div class="alert alert-info">
    <strong>💡 Pro Tip:</strong> When creating or editing pages, always reference this styleguide to maintain consistency across your course.
  </div>

  <hr>
  <p><small><em>Last updated: ${new Date().toLocaleDateString()} | This styleguide ensures professional, accessible, and consistent course content.</em></small></p>
</div>
  `.trim();
}

export function registerPageTools(server: any, canvas: CanvasClient) {
  // Tool: generate-styleguide
  server.tool(
    "generate-styleguide",
    "Generate and save a comprehensive Canvas styleguide page for consistent formatting across all course pages. This creates design standards, accessibility guidelines, and Canvas-specific best practices.",
    {
      courseId: z.string().describe("The ID of the course where the styleguide will be saved"),
      includeExamples: z.boolean().default(true).describe("Whether to include visual examples of each style element"),
      customBranding: z.string().optional().describe("Optional custom branding guidelines or color schemes to incorporate")
    },
    async ({ courseId, includeExamples = true, customBranding }: { courseId: string; includeExamples?: boolean; customBranding?: string }) => {
      try {
        const styleguideContent = generateCanvasStyleguide(includeExamples, customBranding);
        
        const styleguide = (await canvas.updateOrCreatePage(courseId, 'canvas-styleguide', {
          wiki_page: {
            title: 'Canvas Course Styleguide',
            body: styleguideContent
          }
        }) as any);

        return {
          content: [
            {
              type: "text",
              text: [
                `✅ Canvas styleguide created successfully!`,
                `Page URL: ${styleguide.url}`,
                `Course ID: ${courseId}`,
                ``,
                `This styleguide will now be automatically referenced by all page creation and editing tools to ensure consistent formatting.`,
                ``,
                `🔗 View at: ${process.env.CANVAS_BASE_URL || 'https://fhict.instructure.com'}/courses/${courseId}/pages/${styleguide.url}`
              ].join('\n')
            }
          ]
        };
      } catch (error: any) {
        if (error instanceof Error) {
          throw new Error(`Failed to generate styleguide: ${error.message}`);
        }
        throw new Error('Failed to generate styleguide: Unknown error');
      }
    }
  );

  // Tool: get-styleguide
  server.tool(
    "get-styleguide",
    "Fetch the Canvas styleguide for a course to reference during page creation or editing. This ensures consistency with established design standards.",
    {
      courseId: z.string().describe("The ID of the course")
    },
    async ({ courseId }: { courseId: string }) => {
      try {
        const styleguide = (await canvas.getPage(courseId, 'canvas-styleguide') as any);
        
        return {
          content: [
            {
              type: "text",
              text: [
                `📋 Canvas Styleguide for Course ${courseId}:`,
                `Title: ${styleguide.title}`,
                `Last Updated: ${styleguide.updated_at}`,
                ``,
                `--- STYLEGUIDE CONTENT ---`,
                styleguide.body || 'No styleguide content found',
                `--- END STYLEGUIDE ---`,
                ``,
                `Use this styleguide to ensure all page content follows consistent formatting and design standards.`
              ].join('\n')
            }
          ]
        };
      } catch (error: any) {
        if (error instanceof Error) {
          throw new Error(`Failed to fetch styleguide: ${error.message} (Create one first using generate-styleguide)`);
        }
        throw new Error('Failed to fetch styleguide: Unknown error');
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
    async ({ courseId }: { courseId: string }) => {
      let pages: any[] = [];
      let page = 1;
      let hasMore = true;
      try {
        while (hasMore) {
          const params = { per_page: 100, page: page };
          const pagePages = (await canvas.listPages(courseId, params) as any[]);
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
    async ({ courseId, pageUrl }: { courseId: string; pageUrl: string }) => {
      try {
        const page = (await canvas.getPage(courseId, pageUrl) as any);
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
    "FULL REPLACEMENT: Update or create a page with completely new content. Use this when you have the entire new HTML body ready, or when creating pages from scratch. For small edits to existing content, use patch-page-content instead. Automatically references course styleguide for consistency.",
    {
      courseId: z.string().describe("The ID of the course"),
      pageUrl: z.string().describe("The page's URL slug (e.g., 'syllabus')"),
      title: z.string().optional().describe("The new title for the page (optional)"),
      body: z.string().optional().describe("The new HTML body for the page (optional)"),
      editingRoles: z.string().optional().describe("Comma-separated roles allowed to edit (optional)"),
      ignoreStyleguide: z.boolean().default(false).describe("Skip styleguide reference (not recommended)"),
      showStyleguidePreview: z.boolean().default(true).describe("Show styleguide preview when creating content from scratch")
    },
    async ({ courseId, pageUrl, title, body, editingRoles, ignoreStyleguide = false, showStyleguidePreview = true }: { 
      courseId: string; 
      pageUrl: string; 
      title?: string; 
      body?: string; 
      editingRoles?: string;
      ignoreStyleguide?: boolean;
      showStyleguidePreview?: boolean;
    }) => {
      try {
        // If creating content from scratch and no body provided, show styleguide for reference
        if (!body && showStyleguidePreview && !ignoreStyleguide) {
          try {
            const styleguide = (await canvas.getPage(courseId, 'canvas-styleguide') as any);
            return {
              content: [
                {
                  type: "text",
                  text: [
                    `Creating new page '${pageUrl}' in course ${courseId}`,
                    `Title: ${title || 'Not specified'}`,
                    '',
                    '--- COURSE STYLEGUIDE FOR REFERENCE ---',
                    styleguide.body || 'No styleguide content found',
                    '--- END STYLEGUIDE ---',
                    '',
                    'Please create the page content following the above styleguide standards for consistency.',
                    'Use update-page-content again with the body parameter containing your HTML content.'
                  ].join('\n')
                }
              ]
            };
          } catch (error) {
            // Styleguide not found, continue with normal operation
          }
        }

        const wiki_page: any = {};
        if (title !== undefined) wiki_page.title = title;
        if (body !== undefined) wiki_page.body = body;
        if (editingRoles !== undefined) wiki_page.editing_roles = editingRoles;
        
        const page = (await canvas.updateOrCreatePage(courseId, pageUrl, { wiki_page }) as any);
        
        return {
          content: [
            {
              type: "text",
              text: [
                `✅ Page '${page.url}' updated in course ${courseId}.`,
                `Title: ${page.title}`,
                `ID: ${page.page_id}`,
                `Published: ${page.published ? 'Yes' : 'No'}`,
                `Updated At: ${page.updated_at}`,
                '',
                `💡 Tip: Content follows course styleguide standards for consistency.`
              ].join('\n')
            }
          ]
        };
      } catch (error: any) {
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
    async ({ courseId, pageUrl }: { courseId: string; pageUrl: string }) => {
      try {
        const revisions = (await canvas.listPageRevisions(courseId, pageUrl) as any[]);
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
    async ({ courseId, pageUrl, revisionId }: { courseId: string; pageUrl: string; revisionId: string }) => {
      try {
        const page = (await canvas.revertPageRevision(courseId, pageUrl, revisionId) as any);
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
        if (error instanceof Error) {
          throw new Error(`Failed to revert page revision: ${error.message}`);
        }
        throw new Error('Failed to revert page revision: Unknown error');
      }
    }
  );

  // Tool: patch-page-content
  server.tool(
    "patch-page-content",
    "SMART EDITING: Make targeted changes to existing page content using LLM assistance. Give natural language instructions (e.g., 'fix typos', 'update office hours', 'add exam warning'). This is STEP 1 of a 2-step process - use apply-page-changes after reviewing the LLM's modifications. For complete content replacement, use update-page-content instead. Automatically references course styleguide for consistency.",
    {
      courseId: z.string().describe("The ID of the course"),
      pageUrl: z.string().describe("The page's URL slug (e.g., 'syllabus')"),
      instructions: z.string().describe("Natural language instructions for what changes to make to the page content (e.g., 'Update office hours to 2-4pm on MWF', 'Add a warning about the upcoming exam', 'Fix all typos')"),
      title: z.string().optional().describe("New title for the page (optional)"),
      editingRoles: z.string().optional().describe("Comma-separated roles allowed to edit (optional)"),
      ignoreStyleguide: z.boolean().default(false).describe("Skip styleguide reference (not recommended)")
    },
    async ({ courseId, pageUrl, instructions, title, editingRoles, ignoreStyleguide = false }: { 
      courseId: string; 
      pageUrl: string; 
      instructions: string;
      title?: string;
      editingRoles?: string;
      ignoreStyleguide?: boolean;
    }) => {
      try {
        // Fetch the current page content
        const currentPage = (await canvas.getPage(courseId, pageUrl) as any);
        const currentBody = currentPage.body || '';

        // Try to fetch styleguide unless explicitly ignored
        let styleguideContext = '';
        if (!ignoreStyleguide) {
          try {
            const styleguide = (await canvas.getPage(courseId, 'canvas-styleguide') as any);
            styleguideContext = `

--- COURSE STYLEGUIDE STANDARDS ---
${styleguide.body}
--- END STYLEGUIDE ---

IMPORTANT: When making changes, ensure all formatting follows the above styleguide standards for consistency.`;
          } catch (error) {
            styleguideContext = '\n\n⚠️ No course styleguide found. Consider creating one with generate-styleguide for consistent formatting.';
          }
        }

        return {
          content: [
            {
              type: "text",
              text: [
                `Current page content for '${pageUrl}' in course ${courseId}:`,
                `Title: ${currentPage.title}`,
                `Published: ${currentPage.published ? 'Yes' : 'No'}`,
                '',
                '--- CURRENT CONTENT ---',
                currentBody,
                '--- END CURRENT CONTENT ---',
                styleguideContext,
                '',
                `Instructions: ${instructions}`,
                '',
                'Please modify the above HTML content according to the instructions. Follow the styleguide standards for consistency. Respond with ONLY the modified HTML content that should replace the current body. Preserve the existing structure and formatting unless the instructions specifically ask to change it.',
                '',
                'After you provide the modified content, I will update the page automatically.'
              ].join('\n')
            }
          ]
        };
      } catch (error: any) {
        if (error instanceof Error) {
          throw new Error(`Failed to fetch page for patching: ${error.message}`);
        }
        throw new Error('Failed to fetch page for patching: Unknown error');
      }
    }
  );

  // Tool: apply-page-changes
  server.tool(
    "apply-page-changes",
    "STEP 2: Apply LLM-generated page modifications. Use this after patch-page-content shows you the proposed changes. This completes the smart editing workflow by actually updating the Canvas page with the reviewed modifications.",
    {
      courseId: z.string().describe("The ID of the course"),
      pageUrl: z.string().describe("The page's URL slug (e.g., 'syllabus')"),
      newContent: z.string().describe("The new HTML content for the page body"),
      title: z.string().optional().describe("New title for the page (optional)"),
      editingRoles: z.string().optional().describe("Comma-separated roles allowed to edit (optional)")
    },
    async ({ courseId, pageUrl, newContent, title, editingRoles }: { 
      courseId: string; 
      pageUrl: string; 
      newContent: string;
      title?: string;
      editingRoles?: string;
    }) => {
      try {
        // Prepare the update payload
        const wiki_page: any = { body: newContent };
        if (title !== undefined) wiki_page.title = title;
        if (editingRoles !== undefined) wiki_page.editing_roles = editingRoles;

        // Update the page
        const updatedPage = (await canvas.updateOrCreatePage(courseId, pageUrl, { wiki_page }) as any);

        return {
          content: [
            {
              type: "text",
              text: [
                `✅ Page '${updatedPage.url}' successfully updated in course ${courseId}!`,
                `Title: ${updatedPage.title}`,
                `ID: ${updatedPage.page_id}`,
                `Published: ${updatedPage.published ? 'Yes' : 'No'}`,
                `Updated At: ${updatedPage.updated_at}`,
                '',
                'The changes have been applied successfully.'
              ].join('\n')
            }
          ]
        };
      } catch (error: any) {
        if (error instanceof Error) {
          throw new Error(`Failed to apply page changes: ${error.message}`);
        }
        throw new Error('Failed to apply page changes: Unknown error');
      }
    }
  );
} 