/**
 * Analytics Service
 * Handles all analytics and reporting API operations using the centralized API layer
 */

import { analyticsService } from './serviceFactory';

export interface DashboardMetrics {
  total_employees: number;
  active_employees: number;
  new_hires: number;
  pending_approvals: number;
  documents_pending_review: number;
  compliance_rate: number;
  average_profile_completion: number;
  verification_stats: {
    verified: number;
    pending: number;
    rejected: number;
    not_started: number;
  };
  last_updated: string;
}

export interface EmployeeGrowthData {
  period: string;
  total_employees: number;
  new_hires: number;
  departures: number;
  net_growth: number;
  growth_rate: number;
}

export interface DepartmentMetrics {
  department: string;
  total_employees: number;
  verified_employees: number;
  pending_employees: number;
  compliance_rate: number;
  average_completion: number;
  document_compliance: number;
}

export interface PerformanceMetrics {
  employee_id: string;
  employee_name: string;
  department: string;
  profile_completion: number;
  documents_submitted: number;
  documents_approved: number;
  goals_completed: number;
  performance_score: number;
  last_activity: string;
}

export interface ComplianceMetrics {
  total_employees: number;
  compliant_employees: number;
  non_compliant_employees: number;
  overall_compliance_rate: number;
  document_compliance: {
    total_required: number;
    submitted: number;
    approved: number;
    rejected: number;
    missing: number;
    expired: number;
  };
  department_compliance: DepartmentMetrics[];
  trending: {
    direction: 'up' | 'down' | 'stable';
    percentage_change: number;
    period: string;
  };
}

export interface DocumentAnalytics {
  total_documents: number;
  documents_by_status: {
    pending: number;
    approved: number;
    rejected: number;
    expired: number;
  };
  documents_by_type: Array<{
    type: string;
    count: number;
    approval_rate: number;
    average_review_time: number;
  }>;
  upload_trends: Array<{
    date: string;
    uploads: number;
    approvals: number;
    rejections: number;
  }>;
  compliance_by_department: Array<{
    department: string;
    required_docs: number;
    submitted_docs: number;
    compliance_rate: number;
  }>;
}

export interface UserActivityAnalytics {
  active_users_today: number;
  active_users_week: number;
  active_users_month: number;
  total_sessions: number;
  average_session_duration: number;
  login_frequency: Array<{
    hour: number;
    logins: number;
  }>;
  feature_usage: Array<{
    feature: string;
    usage_count: number;
    unique_users: number;
  }>;
  user_engagement: {
    highly_active: number;
    moderately_active: number;
    low_activity: number;
    inactive: number;
  };
}

export interface ReportData {
  report_id: string;
  report_type: 'employee' | 'department' | 'compliance' | 'performance' | 'documents' | 'custom';
  title: string;
  description?: string;
  generated_at: string;
  generated_by: string;
  parameters: Record<string, any>;
  data: any;
  format: 'json' | 'csv' | 'xlsx' | 'pdf';
  download_url?: string;
  expires_at?: string;
}

export interface AnalyticsFilters {
  start_date?: string;
  end_date?: string;
  departments?: string[];
  employee_types?: string[];
  verification_status?: string[];
  include_inactive?: boolean;
  limit?: number;
  offset?: number;
}

export interface TrendAnalysis {
  metric: string;
  period: string;
  data_points: Array<{
    date: string;
    value: number;
    change_from_previous: number;
  }>;
  trend_direction: 'increasing' | 'decreasing' | 'stable';
  trend_strength: 'strong' | 'moderate' | 'weak';
  seasonal_patterns: Array<{
    pattern: string;
    confidence: number;
  }>;
  forecasts: Array<{
    date: string;
    predicted_value: number;
    confidence_interval: {
      lower: number;
      upper: number;
    };
  }>;
}

class AnalyticsService {
  /**
   * Get admin dashboard metrics
   */
  async getAdminDashboardMetrics(): Promise<DashboardMetrics> {
    try {
      return await analyticsService.get<DashboardMetrics>('/analytics/admin/dashboard');
    } catch (error) {
      console.error('Failed to fetch admin dashboard metrics:', error);
      throw error;
    }
  }

  /**
   * Get manager dashboard metrics
   */
  async getManagerDashboardMetrics(managerId?: string): Promise<DashboardMetrics> {
    try {
      const endpoint = managerId 
        ? `/analytics/manager/dashboard?manager_id=${managerId}` 
        : '/analytics/manager/dashboard';
      return await analyticsService.get<DashboardMetrics>(endpoint);
    } catch (error) {
      console.error('Failed to fetch manager dashboard metrics:', error);
      throw error;
    }
  }

  /**
   * Get employee growth analytics
   */
  async getEmployeeGrowthAnalytics(
    period: 'daily' | 'weekly' | 'monthly' | 'quarterly' = 'monthly',
    filters: AnalyticsFilters = {}
  ): Promise<EmployeeGrowthData[]> {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('period', period);
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => queryParams.append(key, v));
          } else {
            queryParams.append(key, value.toString());
          }
        }
      });

      return await analyticsService.get(`/analytics/employee-growth?${queryParams.toString()}`);
    } catch (error) {
      console.error('Failed to fetch employee growth analytics:', error);
      throw error;
    }
  }

  /**
   * Get department analytics
   */
  async getDepartmentAnalytics(filters: AnalyticsFilters = {}): Promise<DepartmentMetrics[]> {
    try {
      const queryParams = new URLSearchParams();
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => queryParams.append(key, v));
          } else {
            queryParams.append(key, value.toString());
          }
        }
      });

      const endpoint = `/analytics/departments${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      return await analyticsService.get<DepartmentMetrics[]>(endpoint);
    } catch (error) {
      console.error('Failed to fetch department analytics:', error);
      throw error;
    }
  }

  /**
   * Get performance analytics
   */
  async getPerformanceAnalytics(filters: AnalyticsFilters = {}): Promise<{
    overall_metrics: {
      average_profile_completion: number;
      average_document_compliance: number;
      average_goal_completion: number;
      top_performers: PerformanceMetrics[];
      needs_attention: PerformanceMetrics[];
    };
    detailed_metrics: PerformanceMetrics[];
  }> {
    try {
      const queryParams = new URLSearchParams();
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => queryParams.append(key, v));
          } else {
            queryParams.append(key, value.toString());
          }
        }
      });

      const endpoint = `/analytics/performance${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      return await analyticsService.get(endpoint);
    } catch (error) {
      console.error('Failed to fetch performance analytics:', error);
      throw error;
    }
  }

  /**
   * Get compliance analytics
   */
  async getComplianceAnalytics(filters: AnalyticsFilters = {}): Promise<ComplianceMetrics> {
    try {
      const queryParams = new URLSearchParams();
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => queryParams.append(key, v));
          } else {
            queryParams.append(key, value.toString());
          }
        }
      });

      const endpoint = `/analytics/compliance${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      return await analyticsService.get<ComplianceMetrics>(endpoint);
    } catch (error) {
      console.error('Failed to fetch compliance analytics:', error);
      throw error;
    }
  }

  /**
   * Get document analytics
   */
  async getDocumentAnalytics(filters: AnalyticsFilters = {}): Promise<DocumentAnalytics> {
    try {
      const queryParams = new URLSearchParams();
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => queryParams.append(key, v));
          } else {
            queryParams.append(key, value.toString());
          }
        }
      });

      const endpoint = `/analytics/documents${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      return await analyticsService.get<DocumentAnalytics>(endpoint);
    } catch (error) {
      console.error('Failed to fetch document analytics:', error);
      throw error;
    }
  }

  /**
   * Get user activity analytics
   */
  async getUserActivityAnalytics(
    period: 'day' | 'week' | 'month' = 'week'
  ): Promise<UserActivityAnalytics> {
    try {
      return await analyticsService.get<UserActivityAnalytics>(`/analytics/user-activity?period=${period}`);
    } catch (error) {
      console.error('Failed to fetch user activity analytics:', error);
      throw error;
    }
  }

  /**
   * Generate custom report
   */
  async generateReport(reportConfig: {
    report_type: ReportData['report_type'];
    title: string;
    description?: string;
    parameters: {
      metrics: string[];
      filters: AnalyticsFilters;
      grouping?: string[];
      aggregation?: 'sum' | 'average' | 'count' | 'percentage';
    };
    format: 'json' | 'csv' | 'xlsx' | 'pdf';
  }): Promise<ReportData> {
    try {
      return await analyticsService.post<ReportData>('/analytics/reports', reportConfig);
    } catch (error) {
      console.error('Failed to generate report:', error);
      throw error;
    }
  }

  /**
   * Get generated reports
   */
  async getReports(filters: {
    report_type?: ReportData['report_type'];
    generated_by?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{
    reports: ReportData[];
    total: number;
  }> {
    try {
      const queryParams = new URLSearchParams();
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });

      const endpoint = `/analytics/reports${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      return await analyticsService.get(endpoint);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
      throw error;
    }
  }

  /**
   * Download report
   */
  async downloadReport(reportId: string): Promise<void> {
    try {
      await analyticsService.download(`/analytics/reports/${reportId}/download`);
    } catch (error) {
      console.error('Failed to download report:', error);
      throw error;
    }
  }

  /**
   * Delete report
   */
  async deleteReport(reportId: string): Promise<void> {
    try {
      await analyticsService.delete(`/analytics/reports/${reportId}`);
    } catch (error) {
      console.error('Failed to delete report:', error);
      throw error;
    }
  }

  /**
   * Get trend analysis for a metric
   */
  async getTrendAnalysis(
    metric: string,
    period: '7d' | '30d' | '90d' | '1y' = '30d',
    filters: AnalyticsFilters = {}
  ): Promise<TrendAnalysis> {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('metric', metric);
      queryParams.append('period', period);
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => queryParams.append(key, v));
          } else {
            queryParams.append(key, value.toString());
          }
        }
      });

      return await analyticsService.get(`/analytics/trends?${queryParams.toString()}`);
    } catch (error) {
      console.error('Failed to fetch trend analysis:', error);
      throw error;
    }
  }

  /**
   * Get comparative analytics between periods
   */
  async getComparativeAnalytics(config: {
    metric: string;
    current_period: { start: string; end: string };
    comparison_period: { start: string; end: string };
    filters?: AnalyticsFilters;
  }): Promise<{
    current_period: {
      value: number;
      period_label: string;
    };
    comparison_period: {
      value: number;
      period_label: string;
    };
    change: {
      absolute: number;
      percentage: number;
      direction: 'increase' | 'decrease' | 'no_change';
    };
    significance: 'significant' | 'minor' | 'negligible';
  }> {
    try {
      return await analyticsService.post('/analytics/compare', config);
    } catch (error) {
      console.error('Failed to fetch comparative analytics:', error);
      throw error;
    }
  }

  /**
   * Get real-time metrics
   */
  async getRealTimeMetrics(): Promise<{
    active_users: number;
    current_sessions: number;
    documents_uploaded_today: number;
    approvals_pending: number;
    system_load: number;
    last_updated: string;
  }> {
    try {
      return await analyticsService.get('/analytics/real-time');
    } catch (error) {
      console.error('Failed to fetch real-time metrics:', error);
      throw error;
    }
  }

  /**
   * Get predictive analytics
   */
  async getPredictiveAnalytics(
    metric: string,
    prediction_period: '1m' | '3m' | '6m' | '1y' = '3m'
  ): Promise<{
    metric: string;
    current_value: number;
    predictions: Array<{
      date: string;
      predicted_value: number;
      confidence: number;
      factors: Array<{
        factor: string;
        impact: number;
      }>;
    }>;
    accuracy_score: number;
    model_version: string;
  }> {
    try {
      return await analyticsService.get(`/analytics/predictions?metric=${metric}&period=${prediction_period}`);
    } catch (error) {
      console.error('Failed to fetch predictive analytics:', error);
      throw error;
    }
  }

  /**
   * Export analytics data
   */
  async exportAnalyticsData(config: {
    data_type: 'employees' | 'departments' | 'documents' | 'performance' | 'compliance';
    format: 'csv' | 'xlsx' | 'json';
    filters: AnalyticsFilters;
    include_historical?: boolean;
  }): Promise<void> {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('data_type', config.data_type);
      queryParams.append('format', config.format);
      queryParams.append('include_historical', (config.include_historical || false).toString());
      
      Object.entries(config.filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => queryParams.append(key, v));
          } else {
            queryParams.append(key, value.toString());
          }
        }
      });

      await analyticsService.download(
        `/analytics/export?${queryParams.toString()}`,
        `analytics-${config.data_type}-${new Date().toISOString().split('T')[0]}.${config.format}`
      );
    } catch (error) {
      console.error('Failed to export analytics data:', error);
      throw error;
    }
  }

  /**
   * Get metric definitions
   */
  async getMetricDefinitions(): Promise<Array<{
    name: string;
    description: string;
    formula: string;
    data_sources: string[];
    update_frequency: string;
    category: string;
  }>> {
    try {
      return await analyticsService.get('/analytics/metric-definitions');
    } catch (error) {
      console.error('Failed to fetch metric definitions:', error);
      throw error;
    }
  }

  /**
   * Create custom metric
   */
  async createCustomMetric(metricConfig: {
    name: string;
    description: string;
    formula: string;
    data_sources: string[];
    update_frequency: 'real_time' | 'hourly' | 'daily' | 'weekly';
    category: string;
  }): Promise<{ metric_id: string; created_at: string }> {
    try {
      return await analyticsService.post('/analytics/custom-metrics', metricConfig);
    } catch (error) {
      console.error('Failed to create custom metric:', error);
      throw error;
    }
  }

  /**
   * Get data quality metrics
   */
  async getDataQualityMetrics(): Promise<{
    overall_score: number;
    completeness: {
      employee_profiles: number;
      documents: number;
      performance_data: number;
    };
    accuracy: {
      data_validation_errors: number;
      inconsistent_records: number;
      duplicate_records: number;
    };
    timeliness: {
      stale_data_percentage: number;
      average_update_lag: number;
    };
    recommendations: Array<{
      issue: string;
      impact: 'high' | 'medium' | 'low';
      recommendation: string;
    }>;
  }> {
    try {
      return await analyticsService.get('/analytics/data-quality');
    } catch (error) {
      console.error('Failed to fetch data quality metrics:', error);
      throw error;
    }
  }
}

// Create singleton instance
const analyticsServiceInstance = new AnalyticsService();

export default analyticsServiceInstance;