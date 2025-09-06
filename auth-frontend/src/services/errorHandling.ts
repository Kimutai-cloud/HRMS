/**
 * API Error Handling and Retry Logic Utilities
 * Provides additional error handling capabilities on top of the centralized API service
 */

import { toast } from '@/hooks/use-toast';
import { type ApiError } from './apiService';

export interface ErrorHandlingOptions {
  showToast?: boolean;
  logError?: boolean;
  redirectOnAuth?: boolean;
  customMessage?: string;
  retryable?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

export interface RetryableOperation<T> {
  operation: () => Promise<T>;
  maxRetries?: number;
  retryDelay?: number;
  backoffMultiplier?: number;
  onRetry?: (attempt: number, error: ApiError) => void;
  shouldRetry?: (error: ApiError) => boolean;
}

/**
 * Enhanced error handler with context-aware responses
 */
export class ApiErrorHandler {
  private static instance: ApiErrorHandler;
  private readonly errorMap: Map<string, ErrorHandlingOptions> = new Map();

  private constructor() {
    this.setupDefaultErrorHandlers();
  }

  public static getInstance(): ApiErrorHandler {
    if (!ApiErrorHandler.instance) {
      ApiErrorHandler.instance = new ApiErrorHandler();
    }
    return ApiErrorHandler.instance;
  }

  /**
   * Setup default error handling patterns
   */
  private setupDefaultErrorHandlers(): void {
    // Authentication errors
    this.errorMap.set('401', {
      showToast: true,
      logError: true,
      redirectOnAuth: true,
      customMessage: 'Your session has expired. Please log in again.',
      retryable: false,
    });

    // Authorization errors
    this.errorMap.set('403', {
      showToast: true,
      logError: true,
      redirectOnAuth: false,
      customMessage: 'You don\'t have permission to perform this action.',
      retryable: false,
    });

    // Not found errors
    this.errorMap.set('404', {
      showToast: true,
      logError: false,
      redirectOnAuth: false,
      customMessage: 'The requested resource was not found.',
      retryable: false,
    });

    // Validation errors
    this.errorMap.set('422', {
      showToast: true,
      logError: false,
      redirectOnAuth: false,
      customMessage: 'Please check your input and try again.',
      retryable: false,
    });

    // Rate limiting
    this.errorMap.set('429', {
      showToast: true,
      logError: true,
      redirectOnAuth: false,
      customMessage: 'Too many requests. Please wait a moment and try again.',
      retryable: true,
      maxRetries: 3,
      retryDelay: 5000,
    });

    // Server errors
    this.errorMap.set('5xx', {
      showToast: true,
      logError: true,
      redirectOnAuth: false,
      customMessage: 'Server error occurred. Please try again later.',
      retryable: true,
      maxRetries: 2,
      retryDelay: 3000,
    });

    // Network errors
    this.errorMap.set('network', {
      showToast: true,
      logError: true,
      redirectOnAuth: false,
      customMessage: 'Network error. Please check your connection and try again.',
      retryable: true,
      maxRetries: 3,
      retryDelay: 2000,
    });
  }

  /**
   * Handle API error with context-aware response
   */
  public async handleError(
    error: ApiError,
    context?: {
      operation?: string;
      component?: string;
      userId?: string;
      additionalData?: Record<string, any>;
    },
    customOptions?: ErrorHandlingOptions
  ): Promise<void> {
    const errorKey = this.getErrorKey(error);
    const defaultOptions = this.errorMap.get(errorKey) || this.errorMap.get('5xx')!;
    const options = { ...defaultOptions, ...customOptions };

    // Log error if enabled
    if (options.logError) {
      this.logError(error, context);
    }

    // Show toast notification if enabled
    if (options.showToast) {
      this.showErrorToast(error, options.customMessage);
    }

    // Handle authentication redirect
    if (options.redirectOnAuth && error.status === 401) {
      await this.handleAuthenticationError();
    }

    // Send error analytics
    this.sendErrorAnalytics(error, context);
  }

  /**
   * Execute retryable operation with exponential backoff
   */
  public async executeWithRetry<T>(config: RetryableOperation<T>): Promise<T> {
    const {
      operation,
      maxRetries = 3,
      retryDelay = 1000,
      backoffMultiplier = 2,
      onRetry,
      shouldRetry = this.defaultShouldRetry,
    } = config;

    let lastError: ApiError;
    let delay = retryDelay;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as ApiError;

        // Don't retry on last attempt
        if (attempt === maxRetries + 1) {
          break;
        }

        // Check if error is retryable
        if (!shouldRetry(lastError)) {
          break;
        }

        // Call retry callback
        if (onRetry) {
          onRetry(attempt, lastError);
        }

        // Wait before retry with exponential backoff
        await this.sleep(delay);
        delay *= backoffMultiplier;
      }
    }

    throw lastError!;
  }

  /**
   * Batch operation with individual error handling
   */
  public async executeBatch<T, R>(
    items: T[],
    operation: (item: T) => Promise<R>,
    options: {
      maxConcurrency?: number;
      continueOnError?: boolean;
      onItemError?: (item: T, error: ApiError) => void;
      onItemSuccess?: (item: T, result: R) => void;
    } = {}
  ): Promise<{
    results: R[];
    errors: Array<{ item: T; error: ApiError }>;
    succeeded: number;
    failed: number;
  }> {
    const {
      maxConcurrency = 5,
      continueOnError = true,
      onItemError,
      onItemSuccess,
    } = options;

    const results: R[] = [];
    const errors: Array<{ item: T; error: ApiError }> = [];
    let succeeded = 0;
    let failed = 0;

    // Process items in batches
    for (let i = 0; i < items.length; i += maxConcurrency) {
      const batch = items.slice(i, i + maxConcurrency);
      
      const batchPromises = batch.map(async (item) => {
        try {
          const result = await operation(item);
          results.push(result);
          succeeded++;
          
          if (onItemSuccess) {
            onItemSuccess(item, result);
          }
        } catch (error) {
          const apiError = error as ApiError;
          errors.push({ item, error: apiError });
          failed++;
          
          if (onItemError) {
            onItemError(item, apiError);
          }
          
          if (!continueOnError) {
            throw apiError;
          }
        }
      });

      await Promise.all(batchPromises);
    }

    return { results, errors, succeeded, failed };
  }

  /**
   * Circuit breaker pattern implementation
   */
  public createCircuitBreaker<T extends any[], R>(
    operation: (...args: T) => Promise<R>,
    options: {
      failureThreshold?: number;
      resetTimeout?: number;
      monitoringPeriod?: number;
      onStateChange?: (state: 'closed' | 'open' | 'half-open') => void;
    } = {}
  ): (...args: T) => Promise<R> {
    const {
      failureThreshold = 5,
      resetTimeout = 60000,
      monitoringPeriod = 10000,
      onStateChange,
    } = options;

    let state: 'closed' | 'open' | 'half-open' = 'closed';
    let failureCount = 0;
    let lastFailureTime = 0;
    let successes = 0;

    const changeState = (newState: typeof state) => {
      if (state !== newState) {
        state = newState;
        if (onStateChange) {
          onStateChange(newState);
        }
      }
    };

    return async (...args: T): Promise<R> => {
      const now = Date.now();

      // Reset failure count if monitoring period has passed
      if (now - lastFailureTime > monitoringPeriod) {
        failureCount = 0;
        if (state === 'open') {
          changeState('half-open');
        }
      }

      // Circuit is open
      if (state === 'open') {
        if (now - lastFailureTime < resetTimeout) {
          throw new Error('Circuit breaker is open');
        } else {
          changeState('half-open');
        }
      }

      try {
        const result = await operation(...args);
        
        // Success in half-open state
        if (state === 'half-open') {
          successes++;
          if (successes >= 2) {
            changeState('closed');
            failureCount = 0;
            successes = 0;
          }
        }
        
        return result;
      } catch (error) {
        failureCount++;
        lastFailureTime = now;
        
        if (failureCount >= failureThreshold) {
          changeState('open');
        }
        
        throw error;
      }
    };
  }

  /**
   * Timeout wrapper for operations
   */
  public withTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    timeoutMessage = 'Operation timed out'
  ): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      }),
    ]);
  }

  /**
   * Cache wrapper with error handling
   */
  public withCache<T>(
    key: string,
    operation: () => Promise<T>,
    ttlMs: number = 300000, // 5 minutes default
    onCacheError?: (error: Error) => void
  ): Promise<T> {
    return new Promise(async (resolve, reject) => {
      try {
        // Try to get from cache
        const cached = this.getFromCache<T>(key);
        if (cached !== null) {
          resolve(cached);
          return;
        }

        // Execute operation
        const result = await operation();
        
        // Store in cache
        this.setInCache(key, result, ttlMs);
        resolve(result);
      } catch (error) {
        // Try cache on error as fallback
        try {
          const cached = this.getFromCache<T>(key, true); // Allow stale
          if (cached !== null) {
            if (onCacheError) {
              onCacheError(error as Error);
            }
            resolve(cached);
            return;
          }
        } catch (cacheError) {
          // Ignore cache errors
        }
        
        reject(error);
      }
    });
  }

  // Private helper methods

  private getErrorKey(error: ApiError): string {
    if (!error.status) return 'network';
    if (error.status >= 500) return '5xx';
    return error.status.toString();
  }

  private logError(error: ApiError, context?: any): void {
    console.error('API Error:', {
      status: error.status,
      message: error.message,
      url: error.response?.url,
      context,
      timestamp: new Date().toISOString(),
      stack: error.stack,
    });
  }

  private showErrorToast(error: ApiError, customMessage?: string): void {
    const message = customMessage || error.message || 'An error occurred';
    
    toast({
      title: 'Error',
      description: message,
      variant: 'destructive',
    });
  }

  private async handleAuthenticationError(): Promise<void> {
    // Clear tokens and redirect to login
    // This would typically integrate with your auth context
    localStorage.removeItem('hrms_access_token');
    localStorage.removeItem('hrms_refresh_token');
    localStorage.removeItem('hrms_token_type');
    
    // In a real app, you'd dispatch a logout action
    window.location.href = '/login';
  }

  private sendErrorAnalytics(error: ApiError, context?: any): void {
    // Send error data to analytics service
    // This is a placeholder for actual analytics implementation
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'api_error', {
        error_status: error.status,
        error_message: error.message,
        context: JSON.stringify(context),
      });
    }
  }

  private defaultShouldRetry = (error: ApiError): boolean => {
    // Network errors are always retryable
    if (!error.status) return true;
    
    // Server errors are retryable
    if (error.status >= 500) return true;
    
    // Rate limiting is retryable
    if (error.status === 429) return true;
    
    // Timeout errors are retryable
    if (error.status === 408) return true;
    
    return false;
  };

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getFromCache<T>(key: string, allowStale = false): T | null {
    try {
      const item = localStorage.getItem(`api_cache_${key}`);
      if (!item) return null;
      
      const { data, expiry } = JSON.parse(item);
      const now = Date.now();
      
      if (!allowStale && now > expiry) {
        localStorage.removeItem(`api_cache_${key}`);
        return null;
      }
      
      return data;
    } catch {
      return null;
    }
  }

  private setInCache<T>(key: string, data: T, ttlMs: number): void {
    try {
      const item = {
        data,
        expiry: Date.now() + ttlMs,
      };
      localStorage.setItem(`api_cache_${key}`, JSON.stringify(item));
    } catch {
      // Ignore cache errors
    }
  }
}

// Export singleton instance
export const apiErrorHandler = ApiErrorHandler.getInstance();

// Convenience functions
export const handleApiError = (
  error: ApiError,
  context?: any,
  options?: ErrorHandlingOptions
) => apiErrorHandler.handleError(error, context, options);

export const executeWithRetry = <T>(config: RetryableOperation<T>) =>
  apiErrorHandler.executeWithRetry(config);

export const createCircuitBreaker = <T extends any[], R>(
  operation: (...args: T) => Promise<R>,
  options?: any
) => apiErrorHandler.createCircuitBreaker(operation, options);

export default apiErrorHandler;