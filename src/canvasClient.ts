import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { DataAnonymizer } from './anonymizer.js';
import { SimpleCache } from './cache.js';

// URL fragments whose responses must never be cached (grade/submission data)
const UNCACHED_PATTERNS = ['/submissions', '/statistics', '/reports', '/events', '/quiz_submissions'];

export class CanvasClient {
  private axios: AxiosInstance;
  private cache = new SimpleCache();

  constructor(baseUrl: string, apiToken: string) {
    this.axios = axios.create({
      baseURL: baseUrl,
      headers: { Authorization: `Bearer ${apiToken}` }
    });
  }

  private isCacheable(url: string): boolean {
    return !UNCACHED_PATTERNS.some(p => url.includes(p));
  }

  private cacheKey(url: string, params: any): string {
    const sorted = Object.keys(params).sort().reduce((acc: any, k) => { acc[k] = params[k]; return acc; }, {});
    return `${url}\0${JSON.stringify(sorted)}`;
  }

  private invalidateForWrite(url: string): void {
    const basePath = url.split('?')[0];
    this.cache.invalidatePrefix(basePath);
    // Refresh the containing collection list (e.g. updating /pages/syllabus
    // should drop the cached /pages list), but never climb so high that a
    // single write wipes an entire course or the API root.
    const parent = basePath.replace(/\/[^/]+$/, '');
    const tooBroad = /^\/api\/v1\/courses\/\d+$/.test(parent) || /^\/api\/v1\/[^/]+$/.test(parent);
    if (parent !== basePath && !tooBroad) this.cache.invalidatePrefix(parent);
  }

  // Generic GET with ETag-based conditional requests and TTL fallback
  async get<T>(url: string, params: any = {}): Promise<T> {
    const cacheable = this.isCacheable(url);
    const key = this.cacheKey(url, params);
    const cached = cacheable ? this.cache.get(key) : undefined;

    // Serve without a network call when still fresh, or when there's no
    // validator (the TTL-only path, already bounded by the cache's expiry)
    if (cached && (this.cache.isFresh(cached) || !(cached.etag || cached.lastModified))) {
      return cached.value as T;
    }

    // Build conditional GET headers when we have a stored validator
    const headers: Record<string, string> = {};
    if (cached?.etag) headers['If-None-Match'] = cached.etag;
    else if (cached?.lastModified) headers['If-Modified-Since'] = cached.lastModified;

    try {
      const response = await this.axios.get(url, {
        params,
        headers,
        validateStatus: s => (s >= 200 && s < 300) || s === 304,
      });

      if (response.status === 304) {
        return cached!.value as T;
      }

      if (cacheable) {
        this.cache.set(key, response.data, response.headers['etag'], response.headers['last-modified']);
      }
      return response.data;
    } catch (error: any) {
      this.handleError(error);
    }
  }

  // Generic POST with error handling and cache invalidation
  async post<T>(url: string, data: any = {}, params: any = {}): Promise<T> {
    try {
      const response = await this.axios.post(url, data, { params });
      this.invalidateForWrite(url);
      return response.data;
    } catch (error: any) {
      this.handleError(error);
    }
  }

  // Generic PUT with error handling and cache invalidation
  async put<T>(url: string, data: any = {}, params: any = {}): Promise<T> {
    try {
      const response = await this.axios.put(url, data, { params });
      this.invalidateForWrite(url);
      return response.data;
    } catch (error: any) {
      this.handleError(error);
    }
  }

  // Generic DELETE with error handling and cache invalidation
  async delete<T>(url: string, params: any = {}): Promise<T> {
    try {
      const response = await this.axios.delete(url, { params });
      this.invalidateForWrite(url);
      return response.data;
    } catch (error: any) {
      this.handleError(error);
    }
  }

  private parseLinkHeader(header: string): Record<string, string> {
    const links: Record<string, string> = {};
    for (const part of header.split(',')) {
      const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
      if (match) links[match[2]] = match[1];
    }
    return links;
  }

  // Fetch all pages for paginated endpoints using Link header.
  // The assembled result is cached (TTL-based) for cacheable URLs so repeated
  // list calls don't re-download every page.
  async fetchAllPages<T>(url: string, params: any = {}): Promise<T[]> {
    const cacheable = this.isCacheable(url);
    const key = this.cacheKey(url, { ...params, __all: true });
    if (cacheable) {
      const cached = this.cache.get(key);
      if (cached && (this.cache.isFresh(cached) || !(cached.etag || cached.lastModified))) {
        return cached.value as T[];
      }
    }
    const results: T[] = [];
    const per_page = params.per_page || 100;
    let page = 1;
    while (true) {
      const response = await this.axios.get(url, { params: { ...params, page, per_page } });
      const data: T[] = response.data;
      if (!Array.isArray(data) || data.length === 0) break;
      results.push(...data);
      const linkHeader = response.headers['link'] as string | undefined;
      if (!linkHeader || !this.parseLinkHeader(linkHeader).next) break;
      page++;
    }
    if (cacheable) this.cache.set(key, results);
    return results;
  }

  // Several quiz endpoints wrap their payload in a JSON-API-ish envelope
  // ({ "quiz_submissions": [...] }) rather than returning a bare array, which
  // fetchAllPages would discard. This merges every top-level array across all
  // pages, keyed by envelope key, deduping by id.
  async fetchAllPagesEnvelope(url: string, params: any = {}): Promise<Record<string, any[]>> {
    const merged: Record<string, any[]> = {};
    const seen: Record<string, Set<any>> = {};
    const per_page = params.per_page || 100;
    let page = 1;
    try {
      while (true) {
        const response = await this.axios.get(url, { params: { ...params, page, per_page } });
        const body = response.data;
        if (!body || typeof body !== 'object') break;

        let addedAny = false;
        for (const [key, value] of Object.entries(body)) {
          if (!Array.isArray(value)) continue;
          merged[key] ??= [];
          seen[key] ??= new Set();
          for (const item of value) {
            const id = item?.id;
            if (id !== undefined) {
              if (seen[key].has(id)) continue;
              seen[key].add(id);
            }
            merged[key].push(item);
            addedAny = true;
          }
        }
        if (!addedAny) break;

        const linkHeader = response.headers['link'] as string | undefined;
        if (!linkHeader || !this.parseLinkHeader(linkHeader).next) break;
        page++;
      }
    } catch (error: any) {
      this.handleError(error);
    }
    return merged;
  }

  // Single-page envelope fetch: pulls one keyed array out of the wrapper.
  async getEnvelope<T>(url: string, key: string, params: any = {}): Promise<T[]> {
    const body = await this.get<any>(url, params);
    const value = body?.[key];
    if (Array.isArray(value)) return value as T[];
    return Array.isArray(body) ? (body as T[]) : [];
  }

  // Fetch a Canvas-hosted file (e.g. a generated quiz report) as text.
  async downloadText(fileUrl: string): Promise<string> {
    try {
      const response = await this.axios.get(fileUrl, { responseType: 'text', maxRedirects: 5 });
      return typeof response.data === 'string' ? response.data : String(response.data);
    } catch (error: any) {
      this.handleError(error);
    }
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
  async listAnnouncements(courseId: string, params: any = {}) {
    return this.get(`/api/v1/courses/${courseId}/discussion_topics`, { only_announcements: true, per_page: 100, ...params });
  }
  async getAnnouncement(courseId: string, topicId: string) {
    return this.get(`/api/v1/courses/${courseId}/discussion_topics/${topicId}`);
  }
  async postAnnouncement(courseId: string, data: any) {
    return this.post(`/api/v1/courses/${courseId}/discussion_topics`, data);
  }
  async updateAnnouncement(courseId: string, topicId: string, data: any) {
    return this.put(`/api/v1/courses/${courseId}/discussion_topics/${topicId}`, data);
  }
  async deleteAnnouncement(courseId: string, topicId: string) {
    return this.delete(`/api/v1/courses/${courseId}/discussion_topics/${topicId}`);
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
    return this.get(`/api/v1/courses/${courseId}/assignment_groups`, { per_page: 100 });
  }
  async createAssignmentGroup(courseId: string, data: any) {
    return this.post(`/api/v1/courses/${courseId}/assignment_groups`, data);
  }

  // --- Modules ---
  async listModules(courseId: string, params: any = {}) {
    return this.get(`/api/v1/courses/${courseId}/modules`, { per_page: 100, ...params });
  }
  async listModuleItems(courseId: string, moduleId: string, params: any = {}) {
    return this.get(`/api/v1/courses/${courseId}/modules/${moduleId}/items`, { per_page: 100, ...params });
  }
  async getModule(courseId: string, moduleId: string) {
    return this.get(`/api/v1/courses/${courseId}/modules/${moduleId}`);
  }
  async updateModulePublish(courseId: string, moduleId: string, data: any) {
    return this.put(`/api/v1/courses/${courseId}/modules/${moduleId}`, data);
  }
  async createModule(courseId: string, data: any) {
    return this.post(`/api/v1/courses/${courseId}/modules`, data);
  }
  async updateModule(courseId: string, moduleId: string, data: any) {
    return this.put(`/api/v1/courses/${courseId}/modules/${moduleId}`, data);
  }
  async getModuleItem(courseId: string, moduleId: string, itemId: string) {
    return this.get(`/api/v1/courses/${courseId}/modules/${moduleId}/items/${itemId}`);
  }
  async createModuleItem(courseId: string, moduleId: string, data: any) {
    return this.post(`/api/v1/courses/${courseId}/modules/${moduleId}/items`, data);
  }
  async updateModuleItem(courseId: string, moduleId: string, itemId: string, data: any) {
    return this.put(`/api/v1/courses/${courseId}/modules/${moduleId}/items/${itemId}`, data);
  }

  // --- Pages ---
  async listPages(courseId: string, params: any = {}) {
    return this.get(`/api/v1/courses/${courseId}/pages`, { per_page: 100, ...params });
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
    const data = await this.fetchAllPages<any>(`/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions`, params);
    return options.anonymous !== false ? DataAnonymizer.anonymizeSubmissions(data) : data;
  }
  async attachRubricToAssignment(courseId: string, assignmentId: string, rubricId: string) {
    return this.put(`/api/v1/courses/${courseId}/assignments/${assignmentId}`, {}, { rubric_id: rubricId });
  }

  // --- Students ---
  async listStudents(courseId: string, params: any = {}, options: { anonymous?: boolean } = {}) {
    const data = await this.fetchAllPages<any>(`/api/v1/courses/${courseId}/users`, params);
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
    const data = await this.fetchAllPages<any>(`/api/v1/sections/${sectionId}/assignments/${assignmentId}/submissions`, params);
    return options.anonymous !== false ? DataAnonymizer.anonymizeSubmissions(data) : data;
  }

  // --- Submissions ---
  async listAssignmentSubmissions(courseId: string, assignmentId: string, params: any = {}, options: { anonymous?: boolean } = {}) {
    const data = await this.fetchAllPages<any>(`/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions`, params);
    return options.anonymous !== false ? DataAnonymizer.anonymizeSubmissions(data) : data;
  }
  async gradeSubmission(courseId: string, assignmentId: string, userId: string, data: any) {
    return this.put(`/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}`, data);
  }

  // --- Submission Documents ---
  async getSubmission(courseId: string, assignmentId: string, userId: string, params: any = {}) {
    return this.get(`/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}`, params);
  }

  async getSubmissionWithAttachments(courseId: string, assignmentId: string, userId: string, options: { anonymous?: boolean } = {}) {
    const params = { include: ['attachments', 'submission_comments'] };
    const data = await this.get(`/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}`, params);
    return options.anonymous !== false ? DataAnonymizer.anonymizeSubmissions([data])[0] : data;
  }

  async getFileInfo(fileId: string): Promise<any> {
    return this.get(`/api/v1/files/${fileId}`);
  }

  // Download file content (returns the file data as binary or text depending on type)
  async downloadFile(fileId: string): Promise<{ data: any; contentType: string; filename: string }> {
    try {
      // First get the file metadata to get the download URL
      const fileInfo = await this.getFileInfo(fileId);
      
      // Download the actual file content
      const response = await this.axios.get(fileInfo.url, { 
        responseType: 'arraybuffer',
        // Follow redirects as Canvas often returns redirect URLs
        maxRedirects: 5
      });
      
      return {
        data: response.data,
        contentType: response.headers['content-type'] || fileInfo['content-type'] || 'application/octet-stream',
        filename: fileInfo.filename || `file_${fileId}`
      };
    } catch (error: any) {
      this.handleError(error);
    }
  }

  // Get submission documents with file download capability
  async getSubmissionDocuments(courseId: string, assignmentId: string, userId: string, options: { 
    downloadFiles?: boolean; 
    anonymous?: boolean 
  } = {}) {
    try {
      const submission = await this.getSubmissionWithAttachments(courseId, assignmentId, userId, { anonymous: options.anonymous });
      
      const result: any = {
        submission: submission,
        attachments: submission.attachments || [],
        textSubmission: submission.body || null,
        submissionType: submission.submission_type,
        downloadedFiles: []
      };

      // If downloadFiles is true, download all attached files
      if (options.downloadFiles && submission.attachments && submission.attachments.length > 0) {
        for (const attachment of submission.attachments) {
          try {
            const fileData = await this.downloadFile(attachment.id);
            result.downloadedFiles.push({
              id: attachment.id,
              filename: attachment.filename || attachment.display_name,
              contentType: fileData.contentType,
              size: attachment.size,
              data: fileData.data,
              // Convert binary data to base64 for JSON serialization if needed
              dataBase64: Buffer.from(fileData.data).toString('base64')
            });
          } catch (error) {
            console.warn(`Failed to download file ${attachment.id}:`, error);
            result.downloadedFiles.push({
              id: attachment.id,
              filename: attachment.filename || attachment.display_name,
              error: `Failed to download: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
          }
        }
      }

      return result;
    } catch (error: any) {
      this.handleError(error);
    }
  }

  // --- Course Files & Folders (Files section) ---
  async listCourseFolders(courseId: string, params: any = {}) {
    return this.fetchAllPages(`/api/v1/courses/${courseId}/folders`, { per_page: 100, ...params });
  }

  async listFolderFolders(folderId: string, params: any = {}) {
    return this.fetchAllPages(`/api/v1/folders/${folderId}/folders`, { per_page: 100, ...params });
  }

  async getFolder(courseId: string, folderId: string = 'root') {
    return this.get(`/api/v1/courses/${courseId}/folders/${folderId}`);
  }

  async resolveFolderPath(courseId: string, path?: string) {
    const trimmed = (path || '').replace(/^\/+|\/+$/g, '');
    const suffix = trimmed
      ? `/${trimmed.split('/').map(encodeURIComponent).join('/')}`
      : '';
    return this.get(`/api/v1/courses/${courseId}/folders/by_path${suffix}`);
  }

  async listCourseFiles(courseId: string, params: any = {}) {
    return this.fetchAllPages(`/api/v1/courses/${courseId}/files`, { per_page: 100, ...params });
  }

  async listFolderFiles(folderId: string, params: any = {}) {
    return this.fetchAllPages(`/api/v1/folders/${folderId}/files`, { per_page: 100, ...params });
  }
} 