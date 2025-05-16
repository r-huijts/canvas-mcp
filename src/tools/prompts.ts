import { z } from "zod";
import { CanvasClient } from "../canvasClient.js";

export function registerPrompts(server: any, canvas: CanvasClient) {
  server.prompt(
    "analyze-rubric-statistics",
    "Analyze rubric statistics for formative assignments in a course",
    {
      courseName: z.string().describe("The name of the course to analyze")
    },
    ({ courseName }: { courseName: string }) => {
      const today = new Date().toISOString().split('T')[0];
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please analyze the rubric statistics for the course \"${courseName}\". Follow these steps:

1. First, use the list-courses tool to find the course ID for \"${courseName}\".

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
} 