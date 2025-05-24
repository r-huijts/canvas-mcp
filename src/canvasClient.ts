import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { DataAnonymizer } from './anonymizer.js';

export class CanvasClient {
  private axios: AxiosInstance;

  constructor(baseUrl: string, apiToken: string) {
    this.axios = axios.create({
      baseURL: baseUrl,
      headers: { Authorization: `Bearer ${apiToken}` }
    });
  }

  // Generic GET with error handling
  async get<T>(url: string, params: any = {}): Promise<T> {
    try {
      const response = await this.axios.get(url, { params });
      return response.data;
    } catch (error: any) {
      this.handleError(error);
    }
  }

  // Generic POST with error handling
  async post<T>(url: string, data: any = {}, params: any = {}): Promise<T> {
    try {
      const response = await this.axios.post(url, data, { params });
      return response.data;
    } catch (error: any) {
      this.handleError(error);
    }
  }

  // Generic PUT with error handling
  async put<T>(url: string, data: any = {}, params: any = {}): Promise<T> {
    try {
      const response = await this.axios.put(url, data, { params });
      return response.data;
    } catch (error: any) {
      this.handleError(error);
    }
  }

  // Generic DELETE with error handling
  async delete<T>(url: string, params: any = {}): Promise<T> {
    try {
      const response = await this.axios.delete(url, { params });
      return response.data;
    } catch (error: any) {
      this.handleError(error);
    }
  }

  // Fetch all pages for paginated endpoints
  async fetchAllPages<T>(url: string, params: any = {}): Promise<T[]> {
    let results: T[] = [];
    let page = 1;
    let hasMore = true;
    const per_page = params.per_page || 100;
    while (hasMore) {
      const pageParams = { ...params, page, per_page };
      const data: T[] = await this.get<T[]>(url, pageParams);
      results.push(...data);
      hasMore = data.length === per_page;
      page += 1;
    }
    return results;
  }

  // Centralized error handler
  private handleError(error: any): never {
    if (error.response?.data?.errors) {
      throw new Error(JSON.stringify(error.response.data.errors));
    }
    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error('Unknown error occurred in CanvasClient');
  }

  // --- Courses ---
  async listCourses(params: any = {}) {
    return this.get('/api/v1/courses', params);
  }
  async postAnnouncement(courseId: string, data: any) {
    return this.post(`/api/v1/courses/${courseId}/discussion_topics`, data);
  }

  // --- Assignments ---
  async listCourseAssignments(courseId: string, params: any = {}, options: { anonymous?: boolean } = {}) {
    const data = await this.get(`/api/v1/courses/${courseId}/assignments`, params) as any[];
    return options.anonymous !== false ? DataAnonymizer.anonymizeAssignments(data) : data;
  }
  async getAssignment(courseId: string, assignmentId: string) {
    return this.get(`/api/v1/courses/${courseId}/assignments/${assignmentId}`);
  }
  async createAssignment(courseId: string, data: any) {
    return this.post(`/api/v1/courses/${courseId}/assignments`, data);
  }
  async updateAssignment(courseId: string, assignmentId: string, data: any) {
    return this.put(`/api/v1/courses/${courseId}/assignments/${assignmentId}`, data);
  }

  // --- Assignment Groups ---
  async listAssignmentGroups(courseId: string) {
    return this.get(`/api/v1/courses/${courseId}/assignment_groups`);
  }
  async createAssignmentGroup(courseId: string, data: any) {
    return this.post(`/api/v1/courses/${courseId}/assignment_groups`, data);
  }

  // --- Modules ---
  async listModules(courseId: string, params: any = {}) {
    return this.get(`/api/v1/courses/${courseId}/modules`, params);
  }
  async listModuleItems(courseId: string, moduleId: string, params: any = {}) {
    return this.get(`/api/v1/courses/${courseId}/modules/${moduleId}/items`, params);
  }
  async getModule(courseId: string, moduleId: string) {
    return this.get(`/api/v1/courses/${courseId}/modules/${moduleId}`);
  }
  async updateModulePublish(courseId: string, moduleId: string, data: any) {
    return this.put(`/api/v1/courses/${courseId}/modules/${moduleId}`, data);
  }

  // --- Pages ---
  async listPages(courseId: string, params: any = {}) {
    return this.get(`/api/v1/courses/${courseId}/pages`, params);
  }
  async getPage(courseId: string, pageUrl: string) {
    return this.get(`/api/v1/courses/${courseId}/pages/${encodeURIComponent(pageUrl)}`);
  }
  async listPageRevisions(courseId: string, pageUrl: string) {
    return this.get(`/api/v1/courses/${courseId}/pages/${encodeURIComponent(pageUrl)}/revisions`);
  }
  async revertPageRevision(courseId: string, pageUrl: string, revisionId: string) {
    return this.post(`/api/v1/courses/${courseId}/pages/${encodeURIComponent(pageUrl)}/revisions/${revisionId}/revert`);
  }
  async updateOrCreatePage(courseId: string, pageUrl: string, data: any) {
    return this.put(`/api/v1/courses/${courseId}/pages/${encodeURIComponent(pageUrl)}`, data);
  }

  // --- Rubrics ---
  async listRubrics(courseId: string) {
    return this.get(`/api/v1/courses/${courseId}/rubrics`);
  }
  async getRubricStatistics(courseId: string, assignmentId: string, params: any = {}) {
    return this.get(`/api/v1/courses/${courseId}/assignments/${assignmentId}`, params);
  }
  async listRubricAssessments(courseId: string, assignmentId: string, params: any = {}, options: { anonymous?: boolean } = {}) {
    const data = await this.get(`/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions`, params) as any[];
    return options.anonymous !== false ? DataAnonymizer.anonymizeSubmissions(data) : data;
  }
  async attachRubricToAssignment(courseId: string, assignmentId: string, rubricId: string) {
    return this.put(`/api/v1/courses/${courseId}/assignments/${assignmentId}?rubric_id=${encodeURIComponent(rubricId)}`);
  }

  // --- Students ---
  async listStudents(courseId: string, params: any = {}, options: { anonymous?: boolean } = {}) {
    const data = await this.get(`/api/v1/courses/${courseId}/users`, params) as any[];
    return options.anonymous !== false ? DataAnonymizer.anonymizeUsers(data) : data;
  }

  // --- Sections ---
  async listSections(courseId: string, params: any = {}) {
    return this.get(`/api/v1/courses/${courseId}/sections`, params);
  }
  async getSection(courseId: string, sectionId: string) {
    return this.get(`/api/v1/courses/${courseId}/sections/${sectionId}`);
  }
  async listSectionAssignmentSubmissions(sectionId: string, assignmentId: string, params: any = {}, options: { anonymous?: boolean } = {}) {
    const data = await this.get(`/api/v1/sections/${sectionId}/assignments/${assignmentId}/submissions`, params) as any[];
    return options.anonymous !== false ? DataAnonymizer.anonymizeSubmissions(data) : data;
  }

  // --- Submissions ---
  async listAssignmentSubmissions(courseId: string, assignmentId: string, params: any = {}, options: { anonymous?: boolean } = {}) {
    const data = await this.get(`/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions`, params) as any[];
    return options.anonymous !== false ? DataAnonymizer.anonymizeSubmissions(data) : data;
  }
  async gradeSubmission(courseId: string, assignmentId: string, userId: string, data: any) {
    return this.put(`/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}`, data);
  }
} 