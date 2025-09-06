/**
 * Centralized API Service Layer
 * Provides common functionality for all API services including:
 * - Request/response handling
 * - Authentication management
 * - Error handling and retry logic
 * - Request/response interceptors
 * - Rate limiting and throttling
 */

export interface ApiConfig {
  baseURL: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
}

export interface RequestOptions extends RequestInit {
  timeout?: number;
  retry?: boolean;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface ApiError extends Error {
  status?: number;
  statusText?: string;
  response?: Response;
  data?: any;
}

export interface RequestInterceptor {
  (config: RequestInit): RequestInit | Promise<RequestInit>;
}

export interface ResponseInterceptor {
  (response: Response): Response | Promise<Response>;
}

export interface ErrorInterceptor {
  (error: ApiError): Promise<ApiError>;
}

class ApiService {
  private config: ApiConfig;
  private accessToken: string | null = null;
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];
  private errorInterceptors: ErrorInterceptor[] = [];

  constructor(config: ApiConfig) {
    this.config = {
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config,
    };
  }

  /**
   * Set the access token for authenticated requests
   */
  setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  /**
   * Get the current access token
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Add request interceptor
   */
  addRequestInterceptor(interceptor: RequestInterceptor): void {
    this.requestInterceptors.push(interceptor);
  }

  /**
   * Add response interceptor
   */
  addResponseInterceptor(interceptor: ResponseInterceptor): void {
    this.responseInterceptors.push(interceptor);
  }

  /**
   * Add error interceptor
   */
  addErrorInterceptor(interceptor: ErrorInterceptor): void {
    this.errorInterceptors.push(interceptor);
  }

  /**
   * Create timeout promise
   */
  private createTimeoutPromise(timeout: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);
    });
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create API error from response
   */
  private async createApiError(response: Response): Promise<ApiError> {
    let errorData: any = null;
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorData.error || errorMessage;
      } else {
        errorData = await response.text();
        if (errorData) {
          errorMessage = errorData;
        }
      }
    } catch (parseError) {
      console.error('Failed to parse error response:', parseError);
    }

    const error = new Error(errorMessage) as ApiError;
    error.status = response.status;
    error.statusText = response.statusText;
    error.response = response;
    error.data = errorData;

    return error;
  }

  /**
   * Process request through interceptors
   */
  private async processRequestInterceptors(config: RequestInit): Promise<RequestInit> {
    let processedConfig = config;
    
    for (const interceptor of this.requestInterceptors) {
      processedConfig = await interceptor(processedConfig);
    }

    return processedConfig;
  }

  /**
   * Process response through interceptors
   */
  private async processResponseInterceptors(response: Response): Promise<Response> {
    let processedResponse = response;
    
    for (const interceptor of this.responseInterceptors) {
      processedResponse = await interceptor(processedResponse);
    }

    return processedResponse;
  }

  /**
   * Process error through interceptors
   */
  private async processErrorInterceptors(error: ApiError): Promise<ApiError> {
    let processedError = error;
    
    for (const interceptor of this.errorInterceptors) {
      processedError = await interceptor(processedError);
    }

    return processedError;
  }

  /**
   * Determine if error is retryable
   */
  private isRetryableError(error: ApiError): boolean {
    if (!error.status) return true; // Network errors are retryable
    
    // Retry on server errors (5xx) and specific client errors
    // DO NOT retry 4xx client errors (bad request, validation, conflict, etc.)
    return error.status >= 500 || 
           error.status === 408;   // Request Timeout only
           // Removed 429 (Too Many Requests) since it often indicates client error
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number, baseDelay: number): number {
    return baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
  }

  /**
   * Core request method with retry logic
   */
  private async executeRequest<T>(
    url: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const {
      timeout = this.config.timeout!,
      retry = true,
      retryAttempts = this.config.retryAttempts!,
      retryDelay = this.config.retryDelay!,
      ...fetchOptions
    } = options;

    // Prepare headers
    const headers: Record<string, string> = {
      ...this.config.headers,
      ...(fetchOptions.headers as Record<string, string>),
    };

    // Only set Content-Type for non-FormData requests
    // Let browser set Content-Type automatically for FormData (with boundary)
    if (!(fetchOptions.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    // Add authentication header
    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    // Prepare request config
    let requestConfig: RequestInit = {
      ...fetchOptions,
      headers,
    };

    // Process request interceptors
    requestConfig = await this.processRequestInterceptors(requestConfig);

    let lastError: ApiError | null = null;

    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      try {
        // Create fetch promise with timeout
        const fetchPromise = fetch(url, requestConfig);
        const timeoutPromise = this.createTimeoutPromise(timeout);
        
        // Race between fetch and timeout
        const response = await Promise.race([fetchPromise, timeoutPromise]);

        // Process response interceptors
        const processedResponse = await this.processResponseInterceptors(response);

        // Handle HTTP errors
        if (!processedResponse.ok) {
          const error = await this.createApiError(processedResponse);
          
          // Check if we should retry
          if (retry && attempt < retryAttempts && this.isRetryableError(error)) {
            lastError = error;
            const delay = this.calculateRetryDelay(attempt, retryDelay);
            console.warn(`Request failed (attempt ${attempt}/${retryAttempts}), retrying in ${delay}ms:`, error.message);
            await this.sleep(delay);
            continue;
          }

          // Process error interceptors and throw
          const processedError = await this.processErrorInterceptors(error);
          throw processedError;
        }

        // Parse response
        const contentType = processedResponse.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return await processedResponse.json();
        } else {
          return await processedResponse.text() as T;
        }

      } catch (error) {
        // Convert to ApiError if needed
        const apiError = error instanceof Error ? 
          Object.assign(error, { status: 0 }) as ApiError : 
          new Error('Unknown error') as ApiError;

        // Check if we should retry
        if (retry && attempt < retryAttempts && this.isRetryableError(apiError)) {
          lastError = apiError;
          const delay = this.calculateRetryDelay(attempt, retryDelay);
          console.warn(`Request failed (attempt ${attempt}/${retryAttempts}), retrying in ${delay}ms:`, apiError.message);
          await this.sleep(delay);
          continue;
        }

        // Process error interceptors and throw
        const processedError = await this.processErrorInterceptors(apiError);
        throw processedError;
      }
    }

    // This should never be reached, but just in case
    throw lastError || new Error('Request failed after all retry attempts');
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
    const url = `${this.config.baseURL}${endpoint}`;
    return this.executeRequest<T>(url, { ...options, method: 'GET' });
  }

  /**
   * POST request
   */
  async post<T>(
    endpoint: string, 
    data?: any, 
    options: Omit<RequestOptions, 'method'> = {}
  ): Promise<T> {
    const url = `${this.config.baseURL}${endpoint}`;
    // Handle FormData specially - don't stringify it
    const body = data instanceof FormData ? data : (data ? JSON.stringify(data) : undefined);
    return this.executeRequest<T>(url, { ...options, method: 'POST', body });
  }

  /**
   * PUT request
   */
  async put<T>(
    endpoint: string, 
    data?: any, 
    options: Omit<RequestOptions, 'method'> = {}
  ): Promise<T> {
    const url = `${this.config.baseURL}${endpoint}`;
    const body = data ? JSON.stringify(data) : undefined;
    return this.executeRequest<T>(url, { ...options, method: 'PUT', body });
  }

  /**
   * PATCH request
   */
  async patch<T>(
    endpoint: string, 
    data?: any, 
    options: Omit<RequestOptions, 'method'> = {}
  ): Promise<T> {
    const url = `${this.config.baseURL}${endpoint}`;
    const body = data ? JSON.stringify(data) : undefined;
    return this.executeRequest<T>(url, { ...options, method: 'PATCH', body });
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
    const url = `${this.config.baseURL}${endpoint}`;
    return this.executeRequest<T>(url, { ...options, method: 'DELETE' });
  }

  /**
   * Upload file with multipart/form-data
   */
  async upload<T>(
    endpoint: string,
    file: File,
    additionalData: Record<string, string> = {},
    options: Omit<RequestOptions, 'method' | 'body' | 'headers'> = {}
  ): Promise<T> {
    const url = `${this.config.baseURL}${endpoint}`;
    
    const formData = new FormData();
    formData.append('file', file);
    
    // Add additional form data
    Object.entries(additionalData).forEach(([key, value]) => {
      formData.append(key, value);
    });

    // Remove Content-Type header to let browser set it with boundary
    const requestOptions: RequestOptions = {
      ...options,
      method: 'POST',
      body: formData,
    };

    // Don't set Content-Type for form data - browser will set it with boundary
    const authHeaders: Record<string, string> = {};
    if (this.accessToken) {
      authHeaders.Authorization = `Bearer ${this.accessToken}`;
    }

    requestOptions.headers = authHeaders;

    return this.executeRequest<T>(url, requestOptions);
  }

  /**
   * Download file
   */
  async download(
    endpoint: string,
    filename?: string,
    options: Omit<RequestOptions, 'method' | 'body'> = {}
  ): Promise<void> {
    const url = `${this.config.baseURL}${endpoint}`;
    const response = await this.executeRequest<Response>(url, { ...options, method: 'GET' });

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    window.URL.revokeObjectURL(downloadUrl);
  }

  /**
   * Cancel all pending requests (placeholder for future implementation)
   */
  cancelAllRequests(): void {
    // TODO: Implement request cancellation using AbortController
    console.warn('Request cancellation not yet implemented');
  }
}

export default ApiService;