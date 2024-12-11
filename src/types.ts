export interface CanvasConfig {
  apiToken: string;
  baseUrl: string;
}

export interface Term {
  id: number;
  name: string;
  start_at?: string;
  end_at?: string;
}

export interface Course {
  id: number;
  name: string;
  course_code: string;
  workflow_state: string;
  term?: Term;
}

export interface Rubric {
  id: string;
  title: string;
  description?: string;
} 