/**
 * Service Factory
 * Creates and configures service instances with proper error handling and interceptors
 */

import ApiService, { type ApiConfig } from './apiService';
import EmployeeService from './employeeService';
import DepartmentService from './departmentService';
import TaskService from './taskService';

// Environment configuration
const config = {
  AUTH_SERVICE_URL: import.meta.env.VITE_AUTH_SERVICE_URL || 'http://localhost:8000/api/v1',
  EMPLOYEE_SERVICE_URL: import.meta.env.VITE_EMPLOYEE_SERVICE_URL || 'http://localhost:8001/api/v1',
  REQUEST_TIMEOUT: parseInt(import.meta.env.VITE_REQUEST_TIMEOUT || '30000'),
  RETRY_ATTEMPTS: parseInt(import.meta.env.VITE_RETRY_ATTEMPTS || '3'),
  RETRY_DELAY: parseInt(import.meta.env.VITE_RETRY_DELAY || '1000'),
};

/**
 * Create Auth Service instance
 */
export function createAuthService(): ApiService {
  const authConfig: ApiConfig = {
    baseURL: config.AUTH_SERVICE_URL,
    timeout: config.REQUEST_TIMEOUT,
    retryAttempts: config.RETRY_ATTEMPTS,
    retryDelay: config.RETRY_DELAY,
    headers: {
      'X-Service': 'auth-frontend',
      'X-API-Version': 'v1',
    },
  };

  const authService = new ApiService(authConfig);

  // Add auth-specific request interceptor
  authService.addRequestInterceptor((requestConfig) => {
    // Add request ID for tracing
    const requestId = `auth-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return {
      ...requestConfig,
      headers: {
        ...requestConfig.headers,
        'X-Request-ID': requestId,
      },
    };
  });

  // Add auth-specific response interceptor
  authService.addResponseInterceptor((response) => {
    // Log successful auth operations
    if (response.url.includes('/auth/') && response.ok) {
      console.log(`Auth operation successful: ${response.url}`);
    }
    return response;
  });

  // Add auth-specific error interceptor
  authService.addErrorInterceptor(async (error) => {
    // Handle specific auth errors
    if (error.status === 401) {
      console.warn('Authentication failed - token may be expired');
      // Could dispatch logout action here
    } else if (error.status === 403) {
      console.warn('Access forbidden - insufficient permissions');
    }
    
    return error;
  });

  return authService;
}

/**
 * Create Employee Service instance
 */
export function createEmployeeService(): ApiService {
  const employeeConfig: ApiConfig = {
    baseURL: config.EMPLOYEE_SERVICE_URL,
    timeout: config.REQUEST_TIMEOUT,
    retryAttempts: config.RETRY_ATTEMPTS,
    retryDelay: config.RETRY_DELAY,
    headers: {
      'X-Service': 'auth-frontend',
      'X-API-Version': 'v1',
    },
  };

  const employeeService = new ApiService(employeeConfig);

  // Add employee-specific request interceptor
  employeeService.addRequestInterceptor((requestConfig) => {
    // Add request ID for tracing
    const requestId = `emp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return {
      ...requestConfig,
      headers: {
        ...requestConfig.headers,
        'X-Request-ID': requestId,
      },
    };
  });

  // Add employee-specific response interceptor
  employeeService.addResponseInterceptor((response) => {
    // Log successful employee operations
    if (response.ok && (
      response.url.includes('/employees/') || 
      response.url.includes('/documents/') ||
      response.url.includes('/profiles/')
    )) {
      console.log(`Employee operation successful: ${response.url}`);
    }
    return response;
  });

  // Add employee-specific error interceptor
  employeeService.addErrorInterceptor(async (error) => {
    // Handle specific employee service errors
    if (error.status === 404 && error.response?.url.includes('/employees/')) {
      console.warn('Employee not found');
    } else if (error.status === 422) {
      console.warn('Validation error in employee data');
    }
    
    return error;
  });

  return employeeService;
}

/**
 * Create Analytics Service instance
 */
export function createAnalyticsService(): ApiService {
  const analyticsConfig: ApiConfig = {
    baseURL: config.EMPLOYEE_SERVICE_URL, // Analytics endpoints are part of employee service
    timeout: config.REQUEST_TIMEOUT * 2, // Analytics queries might take longer
    retryAttempts: config.RETRY_ATTEMPTS,
    retryDelay: config.RETRY_DELAY,
    headers: {
      'X-Service': 'auth-frontend',
      'X-API-Version': 'v1',
      'X-Service-Type': 'analytics',
    },
  };

  const analyticsService = new ApiService(analyticsConfig);

  // Add analytics-specific request interceptor
  analyticsService.addRequestInterceptor((requestConfig) => {
    const requestId = `analytics-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return {
      ...requestConfig,
      headers: {
        ...requestConfig.headers,
        'X-Request-ID': requestId,
      },
    };
  });

  // Add analytics-specific response interceptor
  analyticsService.addResponseInterceptor((response) => {
    if (response.ok && response.url.includes('/analytics/')) {
      console.log(`Analytics query successful: ${response.url}`);
    }
    return response;
  });

  // Add analytics-specific error interceptor
  analyticsService.addErrorInterceptor(async (error) => {
    if (error.status === 403) {
      console.warn('Analytics access denied - insufficient permissions');
    } else if (error.status === 429) {
      console.warn('Analytics rate limit exceeded');
    }
    
    return error;
  });

  return analyticsService;
}

/**
 * Create Document Service instance
 */
export function createDocumentService(): ApiService {
  const documentConfig: ApiConfig = {
    baseURL: config.EMPLOYEE_SERVICE_URL,
    timeout: config.REQUEST_TIMEOUT * 3, // File operations might take longer
    retryAttempts: 2, // Fewer retries for file operations
    retryDelay: config.RETRY_DELAY,
    headers: {
      'X-Service': 'auth-frontend',
      'X-API-Version': 'v1',
      'X-Service-Type': 'documents',
    },
  };

  const documentService = new ApiService(documentConfig);

  // Add document-specific request interceptor
  documentService.addRequestInterceptor((requestConfig) => {
    const requestId = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return {
      ...requestConfig,
      headers: {
        ...requestConfig.headers,
        'X-Request-ID': requestId,
      },
    };
  });

  // Add document-specific response interceptor
  documentService.addResponseInterceptor((response) => {
    if (response.ok && (
      response.url.includes('/documents/') ||
      response.url.includes('/upload/') ||
      response.url.includes('/download/')
    )) {
      console.log(`Document operation successful: ${response.url}`);
    }
    return response;
  });

  // Add document-specific error interceptor
  documentService.addErrorInterceptor(async (error) => {
    if (error.status === 413) {
      console.warn('File too large for upload');
    } else if (error.status === 415) {
      console.warn('Unsupported file type');
    } else if (error.status === 404 && error.response?.url.includes('/documents/')) {
      console.warn('Document not found');
    }
    
    return error;
  });

  return documentService;
}

/**
 * Create Task Service instance
 */
export function createTaskService(): TaskService {
  const taskConfig: ApiConfig = {
    baseURL: config.EMPLOYEE_SERVICE_URL, // Task endpoints are part of employee service
    timeout: config.REQUEST_TIMEOUT,
    retryAttempts: config.RETRY_ATTEMPTS,
    retryDelay: config.RETRY_DELAY,
    headers: {
      'X-Service': 'auth-frontend',
      'X-API-Version': 'v1',
      'X-Service-Type': 'task-management',
    },
  };

  const apiService = new ApiService(taskConfig);

  // Add task-specific request interceptor
  apiService.addRequestInterceptor((requestConfig) => {
    const requestId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return {
      ...requestConfig,
      headers: {
        ...requestConfig.headers,
        'X-Request-ID': requestId,
      },
    };
  });

  // Add task-specific response interceptor
  apiService.addResponseInterceptor((response) => {
    if (response.ok && (
      response.url.includes('/tasks/') ||
      response.url.includes('/manager/tasks/') ||
      response.url.includes('/employee/tasks/')
    )) {
      console.log(`Task operation successful: ${response.url}`);
    }
    return response;
  });

  // Add task-specific error interceptor
  apiService.addErrorInterceptor(async (error) => {
    // Handle task management specific errors
    if (error.status === 409 && error.response?.url.includes('/tasks/')) {
      console.warn('Task state conflict - invalid operation for current task status');
    } else if (error.status === 422 && error.response?.url.includes('/tasks/')) {
      console.warn('Task validation error - check required fields and enum values');
    } else if (error.status === 403 && error.response?.url.includes('/tasks/')) {
      console.warn('Task access denied - insufficient permissions for task operation');
    }
    
    return error;
  });

  return new TaskService(apiService);
}

// Create singleton instances
export const authService = createAuthService();
// Use the specific EmployeeService class instead of generic ApiService for employee operations
export const employeeService = new EmployeeService();
export const departmentService = new DepartmentService();
export const analyticsService = createAnalyticsService();
export const documentService = createDocumentService();
export const taskService = createTaskService();

/**
 * Set access token for all services
 */
export function setGlobalAccessToken(token: string | null): void {
  authService.setAccessToken(token);
  employeeService.setAccessToken(token);
  departmentService.setAccessToken(token);
  analyticsService.setAccessToken(token);
  documentService.setAccessToken(token);
  taskService.setAccessToken(token);
}

/**
 * Get service by name
 */
export function getService(serviceName: 'auth' | 'employee' | 'department' | 'analytics' | 'document' | 'task'): ApiService | EmployeeService | DepartmentService | TaskService {
  switch (serviceName) {
    case 'auth':
      return authService;
    case 'employee':
      return employeeService;
    case 'department':
      return departmentService;
    case 'analytics':
      return analyticsService;
    case 'document':
      return documentService;
    case 'task':
      return taskService;
    default:
      throw new Error(`Unknown service: ${serviceName}`);
  }
}

export default {
  authService,
  employeeService,
  departmentService,
  analyticsService,
  documentService,
  taskService,
  setGlobalAccessToken,
  getService,
};