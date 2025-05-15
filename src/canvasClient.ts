import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

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
} 