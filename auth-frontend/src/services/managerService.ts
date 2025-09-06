/**
 * Manager Operations Service
 * Handles manager operations using existing Employee Service endpoints
 * Adapted to work with current backend capabilities
 */

import { employeeService } from './serviceFactory';
import { type EmployeeData, type UserProfile, VerificationStatus } from '../types/auth';

// Feature flags for unsupported functionality
const FEATURES = {
  GOALS_MANAGEMENT: false,
  PERFORMANCE_REVIEWS: false,
  LEAVE_MANAGEMENT: false,
  TEAM_SCHEDULING: false,
  ADVANCED_MESSAGING: false,
  ADVANCED_ANALYTICS: false
};

export interface TeamMetrics {
  total_team_members: number;
  verified_members: number;
  pending_members: number;
  rejected_members: number;
  new_members_this_month: number;
  average_profile_completion: number;
  documents_pending_review: number;
  upcoming_reviews: number;
  team_compliance_rate: number;
  last_updated: string;
}

export interface TeamMemberPerformance {
  employee_id: string;
  employee_name: string;
  profile_completion: number;
  documents_submitted: number;
  documents_approved: number;
  last_activity: string;
  onboarding_progress: number;
  goals_completed: number;
  performance_score?: number;
}

export interface GoalData {
  id?: string;
  employee_id: string;
  title: string;
  description: string;
  category: 'performance' | 'skill_development' | 'project' | 'personal';
  priority: 'low' | 'medium' | 'high';
  target_date: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'overdue';
  progress_percentage: number;
  created_by: string;
  created_at?: string;
  completed_at?: string;
}

export interface ReviewData {
  id?: string;
  employee_id: string;
  review_period_start: string;
  review_period_end: string;
  overall_rating: number; // 1-5 scale
  strengths: string;
  areas_for_improvement: string;
  goals_for_next_period: string;
  manager_comments: string;
  employee_comments?: string;
  status: 'draft' | 'pending_employee_review' | 'completed';
  created_at?: string;
  completed_at?: string;
}

export interface TeamSchedule {
  employee_id: string;
  employee_name: string;
  schedule_type: 'standard' | 'flexible' | 'remote';
  work_hours: {
    monday?: { start: string; end: string };
    tuesday?: { start: string; end: string };
    wednesday?: { start: string; end: string };
    thursday?: { start: string; end: string };
    friday?: { start: string; end: string };
    saturday?: { start: string; end: string };
    sunday?: { start: string; end: string };
  };
  time_zone: string;
  effective_from: string;
  notes?: string;
}

export interface LeaveRequest {
  id?: string;
  employee_id: string;
  employee_name: string;
  leave_type: 'vacation' | 'sick' | 'personal' | 'maternity' | 'paternity' | 'emergency';
  start_date: string;
  end_date: string;
  days_requested: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  manager_comments?: string;
  requested_at: string;
  reviewed_at?: string;
}

export interface TeamReport {
  report_type: 'performance' | 'attendance' | 'goals' | 'compliance';
  period_start: string;
  period_end: string;
  team_summary: {
    total_members: number;
    active_members: number;
    performance_average: number;
    compliance_rate: number;
  };
  individual_data: Array<{
    employee_id: string;
    employee_name: string;
    metrics: Record<string, any>;
  }>;
  generated_at: string;
}

class ManagerService {
  /**
   * Get team metrics for the manager - ADAPTED to use existing endpoints
   */
  async getTeamMetrics(): Promise<TeamMetrics> {
    try {
      // Get team members first using existing endpoints
      const teamMembers = await this.getTeamMembers();
      
      if (teamMembers.length === 0) {
        return this.getEmptyTeamMetrics();
      }

      const totalMembers = teamMembers.length;
      const verifiedMembers = teamMembers.filter(m => 
        m.verification_status === 'VERIFIED').length;
      const pendingMembers = teamMembers.filter(m => 
        m.verification_status && m.verification_status.includes('PENDING')).length;
      const rejectedMembers = teamMembers.filter(m => 
        m.verification_status === 'REJECTED').length;
      
      // Calculate average completion from existing profile data
      const avgCompletion = teamMembers.reduce((sum, member) => 
        sum + (member.profile_completion_percentage || 0), 0) / totalMembers;
      
      // Calculate new members (hired in last month)
      const newMembers = this.calculateNewMembers(teamMembers);
      
      const complianceRate = Math.round((verifiedMembers / totalMembers) * 100);

      return {
        total_team_members: totalMembers,
        verified_members: verifiedMembers,
        pending_members: pendingMembers,
        rejected_members: rejectedMembers,
        new_members_this_month: newMembers,
        average_profile_completion: Math.round(avgCompletion),
        documents_pending_review: pendingMembers, // Approximate
        upcoming_reviews: 0, // Not available without review system
        team_compliance_rate: complianceRate,
        last_updated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to calculate team metrics:', error);
      throw error;
    }
  }

  /**
   * Get team members - ADAPTED to use existing employee service method
   */
  async getTeamMembers(): Promise<EmployeeData[]> {
    try {
      console.log('ManagerService: Fetching team members...');
      
      // Use the existing EmployeeService method which calls /employees/me/team
      const teamMembers = await employeeService.getTeamMembers();
      
      console.log(`ManagerService: Found ${teamMembers.length} team members`);
      return teamMembers;
    } catch (error) {
      console.error('Failed to fetch team members:', error);
      // Return empty array instead of throwing to prevent dashboard crashes
      return [];
    }
  }

  /**
   * Get team performance - CALCULATED from existing employee data
   */
  async getTeamPerformance(): Promise<TeamMemberPerformance[]> {
    try {
      const teamMembers = await this.getTeamMembers();
      
      return teamMembers.map(member => ({
        employee_id: member.id,
        employee_name: `${member.first_name} ${member.last_name}`,
        profile_completion: member.profile_completion_percentage || 0,
        documents_submitted: this.calculateDocumentsFromStatus(member.verification_status),
        documents_approved: member.verification_status === 'VERIFIED' ? 1 : 0,
        last_activity: member.updated_at || member.created_at || new Date().toISOString(),
        onboarding_progress: this.calculateOnboardingProgress(member.verification_status),
        goals_completed: 0, // Not available without goals system
        performance_score: this.calculatePerformanceScore(member)
      }));
    } catch (error) {
      console.error('Failed to calculate team performance:', error);
      return [];
    }
  }

  /**
   * Approve team member - USES existing admin endpoint
   */
  async approveTeamMember(employeeId: string, comments?: string): Promise<void> {
    try {
      console.log(`ManagerService: Approving team member ${employeeId}`);
      
      // Use the existing EmployeeService method for approval
      await employeeService.approveEmployee(employeeId, comments || 'Approved by manager');
      
      console.log(`ManagerService: Successfully approved team member ${employeeId}`);
    } catch (error) {
      console.error('Failed to approve team member:', error);
      throw error;
    }
  }

  /**
   * Reject team member - USES existing admin endpoint
   */
  async rejectTeamMember(employeeId: string, reason: string): Promise<void> {
    try {
      console.log(`ManagerService: Rejecting team member ${employeeId}`);
      
      // Use the existing EmployeeService method for rejection
      await employeeService.rejectEmployee(employeeId, reason);
      
      console.log(`ManagerService: Successfully rejected team member ${employeeId}`);
    } catch (error) {
      console.error('Failed to reject team member:', error);
      throw error;
    }
  }

  /**
   * Assign goals to team member - DISABLED (No backend support)
   */
  async assignGoal(goalData: GoalData): Promise<GoalData> {
    if (!FEATURES.GOALS_MANAGEMENT) {
      throw new Error('Goal management not available - feature requires backend implementation');
    }
    throw new Error('Not implemented');
  }

  /**
   * Update goal - DISABLED (No backend support)
   */
  async updateGoal(goalId: string, updates: Partial<GoalData>): Promise<GoalData> {
    if (!FEATURES.GOALS_MANAGEMENT) {
      throw new Error('Goal management not available - feature requires backend implementation');
    }
    throw new Error('Not implemented');
  }

  /**
   * Get goals - DISABLED (No backend support)
   */
  async getGoals(employeeId?: string): Promise<GoalData[]> {
    if (!FEATURES.GOALS_MANAGEMENT) {
      // Return empty array instead of throwing to prevent dashboard crashes
      return [];
    }
    throw new Error('Not implemented');
  }

  /**
   * Delete goal - DISABLED (No backend support)
   */
  async deleteGoal(goalId: string): Promise<void> {
    if (!FEATURES.GOALS_MANAGEMENT) {
      throw new Error('Goal management not available - feature requires backend implementation');
    }
    throw new Error('Not implemented');
  }

  /**
   * Create performance review - DISABLED (No backend support)
   */
  async createPerformanceReview(reviewData: ReviewData): Promise<ReviewData> {
    if (!FEATURES.PERFORMANCE_REVIEWS) {
      throw new Error('Performance reviews not available - feature requires backend implementation');
    }
    throw new Error('Not implemented');
  }

  /**
   * Update performance review - DISABLED (No backend support)
   */
  async updatePerformanceReview(reviewId: string, updates: Partial<ReviewData>): Promise<ReviewData> {
    if (!FEATURES.PERFORMANCE_REVIEWS) {
      throw new Error('Performance reviews not available - feature requires backend implementation');
    }
    throw new Error('Not implemented');
  }

  /**
   * Get performance reviews - DISABLED (No backend support)
   */
  async getPerformanceReviews(employeeId?: string): Promise<ReviewData[]> {
    if (!FEATURES.PERFORMANCE_REVIEWS) {
      return []; // Return empty array to prevent crashes
    }
    throw new Error('Not implemented');
  }

  /**
   * Submit performance review - DISABLED (No backend support)
   */
  async submitPerformanceReview(reviewId: string): Promise<ReviewData> {
    if (!FEATURES.PERFORMANCE_REVIEWS) {
      throw new Error('Performance reviews not available - feature requires backend implementation');
    }
    throw new Error('Not implemented');
  }

  /**
   * Manage team schedules
   */
  async updateTeamSchedule(scheduleData: TeamSchedule): Promise<TeamSchedule> {
    try {
      return await employeeService.put<TeamSchedule>(
        `/managers/me/team/${scheduleData.employee_id}/schedule`, 
        scheduleData
      );
    } catch (error) {
      console.error('Failed to update team schedule:', error);
      throw error;
    }
  }

  /**
   * Get team schedules
   */
  async getTeamSchedules(): Promise<TeamSchedule[]> {
    try {
      return await employeeService.get<TeamSchedule[]>('/managers/me/team/schedules');
    } catch (error) {
      console.error('Failed to fetch team schedules:', error);
      throw error;
    }
  }

  /**
   * Get pending leave requests
   */
  async getPendingLeaveRequests(): Promise<LeaveRequest[]> {
    try {
      return await employeeService.get<LeaveRequest[]>('/managers/me/leave-requests/pending');
    } catch (error) {
      console.error('Failed to fetch pending leave requests:', error);
      throw error;
    }
  }

  /**
   * Approve leave request
   */
  async approveLeaveRequest(requestId: string, comments?: string): Promise<LeaveRequest> {
    try {
      return await employeeService.post<LeaveRequest>(`/managers/me/leave-requests/${requestId}/approve`, {
        manager_comments: comments,
        reviewed_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to approve leave request:', error);
      throw error;
    }
  }

  /**
   * Reject leave request
   */
  async rejectLeaveRequest(requestId: string, reason: string): Promise<LeaveRequest> {
    try {
      return await employeeService.post<LeaveRequest>(`/managers/me/leave-requests/${requestId}/reject`, {
        manager_comments: reason,
        reviewed_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to reject leave request:', error);
      throw error;
    }
  }

  /**
   * Get all leave requests for team
   */
  async getTeamLeaveRequests(status?: 'pending' | 'approved' | 'rejected'): Promise<LeaveRequest[]> {
    try {
      const endpoint = status 
        ? `/managers/me/leave-requests?status=${status}` 
        : '/managers/me/leave-requests';
      return await employeeService.get<LeaveRequest[]>(endpoint);
    } catch (error) {
      console.error('Failed to fetch team leave requests:', error);
      throw error;
    }
  }

  /**
   * Send message to team member
   */
  async sendMessageToTeamMember(
    employeeId: string, 
    message: {
      subject: string;
      body: string;
      priority: 'low' | 'medium' | 'high';
      requires_acknowledgment?: boolean;
    }
  ): Promise<{ message_id: string; sent_at: string }> {
    try {
      return await employeeService.post(`/managers/me/team/${employeeId}/message`, message);
    } catch (error) {
      console.error('Failed to send message to team member:', error);
      throw error;
    }
  }

  /**
   * Send announcement to team
   */
  async sendTeamAnnouncement(announcement: {
    title: string;
    message: string;
    priority: 'low' | 'medium' | 'high';
    requires_acknowledgment?: boolean;
    employee_ids?: string[]; // If not provided, sends to all team members
  }): Promise<{ announcement_id: string; sent_to: number }> {
    try {
      return await employeeService.post('/managers/me/team/announcement', announcement);
    } catch (error) {
      console.error('Failed to send team announcement:', error);
      throw error;
    }
  }

  /**
   * Generate team report
   */
  async generateTeamReport(
    reportType: TeamReport['report_type'],
    startDate: string,
    endDate: string,
    employeeIds?: string[]
  ): Promise<TeamReport> {
    try {
      const payload = {
        report_type: reportType,
        period_start: startDate,
        period_end: endDate,
        employee_ids: employeeIds,
      };

      return await employeeService.post<TeamReport>('/managers/me/reports', payload);
    } catch (error) {
      console.error('Failed to generate team report:', error);
      throw error;
    }
  }

  /**
   * Export team data
   */
  async exportTeamData(
    format: 'csv' | 'xlsx' = 'csv',
    includePerformance = false
  ): Promise<void> {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('format', format);
      queryParams.append('include_performance', includePerformance.toString());

      await employeeService.download(
        `/managers/me/team/export?${queryParams.toString()}`, 
        `team-data-${new Date().toISOString().split('T')[0]}.${format}`
      );
    } catch (error) {
      console.error('Failed to export team data:', error);
      throw error;
    }
  }

  /**
   * Get team documents pending review
   */
  async getTeamDocumentsPendingReview(): Promise<Array<{
    document_id: string;
    employee_id: string;
    employee_name: string;
    document_type: string;
    uploaded_at: string;
    file_name: string;
  }>> {
    try {
      return await employeeService.get('/managers/me/team/documents/pending');
    } catch (error) {
      console.error('Failed to fetch team documents pending review:', error);
      throw error;
    }
  }

  /**
   * Review team member document
   */
  async reviewTeamDocument(
    documentId: string, 
    action: 'approve' | 'reject',
    comments?: string
  ): Promise<{ document_id: string; status: string; reviewed_at: string }> {
    try {
      return await employeeService.post(`/managers/me/team/documents/${documentId}/review`, {
        action,
        comments,
        reviewed_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to review team document:', error);
      throw error;
    }
  }

  /**
   * Get team member onboarding progress
   */
  async getOnboardingProgress(employeeId?: string): Promise<Array<{
    employee_id: string;
    employee_name: string;
    onboarding_stage: string;
    progress_percentage: number;
    tasks_completed: number;
    tasks_total: number;
    started_at: string;
    expected_completion: string;
    status: 'on_track' | 'delayed' | 'completed';
  }>> {
    try {
      const endpoint = employeeId 
        ? `/managers/me/team/${employeeId}/onboarding` 
        : '/managers/me/team/onboarding';
      return await employeeService.get(endpoint);
    } catch (error) {
      console.error('Failed to fetch onboarding progress:', error);
      throw error;
    }
  }

  /**
   * Update onboarding task status
   */
  async updateOnboardingTask(
    employeeId: string,
    taskId: string,
    status: 'completed' | 'in_progress' | 'blocked',
    notes?: string
  ): Promise<void> {
    try {
      await employeeService.put(`/managers/me/team/${employeeId}/onboarding/${taskId}`, {
        status,
        notes,
        updated_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to update onboarding task:', error);
      throw error;
    }
  }

  /**
   * Get manager dashboard summary - AGGREGATED from existing endpoints
   */
  async getDashboardSummary(): Promise<{
    team_metrics: TeamMetrics;
    pending_actions: {
      approvals_needed: number;
      documents_to_review: number;
      leave_requests: number;
      overdue_reviews: number;
    };
    recent_activities: Array<{
      type: string;
      description: string;
      timestamp: string;
      employee_name?: string;
    }>;
    upcoming_deadlines: Array<{
      type: 'review' | 'goal' | 'document' | 'onboarding';
      description: string;
      due_date: string;
      employee_name: string;
    }>;
  }> {
    try {
      console.log('Manager Dashboard: Fetching dashboard summary...');
      
      // Aggregate data from multiple existing endpoints with error handling
      const [teamMetrics, teamMembers, pendingApprovals] = await Promise.allSettled([
        this.getTeamMetrics(),
        this.getTeamMembers(),
        this.getPendingApprovals()
      ]);

      // Handle results with graceful fallbacks
      const metrics = teamMetrics.status === 'fulfilled' 
        ? teamMetrics.value 
        : this.getEmptyTeamMetrics();
      
      const members = teamMembers.status === 'fulfilled' 
        ? teamMembers.value 
        : [];
        
      const approvals = pendingApprovals.status === 'fulfilled' 
        ? pendingApprovals.value 
        : [];

      console.log(`Manager Dashboard: Found ${members.length} team members, ${metrics.pending_members} pending approvals`);

      return {
        team_metrics: metrics,
        pending_actions: {
          approvals_needed: metrics.pending_members,
          documents_to_review: approvals.length,
          leave_requests: 0, // Not available without leave system
          overdue_reviews: 0  // Not available without review system
        },
        recent_activities: this.generateRecentActivities(members),
        upcoming_deadlines: this.generateUpcomingDeadlines(members)
      };
    } catch (error) {
      console.error('Failed to fetch manager dashboard summary:', error);
      
      // Return fallback data instead of throwing to prevent dashboard crashes
      return {
        team_metrics: this.getEmptyTeamMetrics(),
        pending_actions: {
          approvals_needed: 0,
          documents_to_review: 0,
          leave_requests: 0,
          overdue_reviews: 0
        },
        recent_activities: [],
        upcoming_deadlines: []
      };
    }
  }

  // =====================================
  // HELPER METHODS - Added for Phase 1
  // =====================================

  /**
   * Get empty team metrics for managers with no team members
   */
  private getEmptyTeamMetrics(): TeamMetrics {
    return {
      total_team_members: 0,
      verified_members: 0,
      pending_members: 0,
      rejected_members: 0,
      new_members_this_month: 0,
      average_profile_completion: 0,
      documents_pending_review: 0,
      upcoming_reviews: 0,
      team_compliance_rate: 0,
      last_updated: new Date().toISOString()
    };
  }

  /**
   * Calculate new members hired in the last month
   */
  private calculateNewMembers(teamMembers: EmployeeData[]): number {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    return teamMembers.filter(member => {
      const hireDate = member.hired_at || member.created_at;
      return hireDate && new Date(hireDate) > oneMonthAgo;
    }).length;
  }

  /**
   * Calculate onboarding progress based on verification status
   */
  private calculateOnboardingProgress(verificationStatus: string | undefined): number {
    const progressMap: Record<string, number> = {
      'NOT_STARTED': 0,
      'NOT_SUBMITTED': 10,
      'PENDING_DETAILS_REVIEW': 40,
      'PENDING_DOCUMENTS_REVIEW': 60,
      'PENDING_ROLE_ASSIGNMENT': 80,
      'PENDING_FINAL_APPROVAL': 90,
      'VERIFIED': 100,
      'REJECTED': 25
    };
    return progressMap[verificationStatus || 'NOT_STARTED'] || 0;
  }

  /**
   * Calculate documents submitted based on verification status
   */
  private calculateDocumentsFromStatus(verificationStatus: string | undefined): number {
    if (!verificationStatus) return 0;
    
    // Estimate documents based on progression through verification
    if (verificationStatus.includes('DOCUMENTS') || verificationStatus === 'VERIFIED') {
      return 1;
    }
    return 0;
  }

  /**
   * Calculate basic performance score from available data
   */
  private calculatePerformanceScore(member: EmployeeData): number {
    let score = 0;
    
    // Base score from profile completion
    score += (member.profile_completion_percentage || 0) * 0.4;
    
    // Bonus for verification status
    if (member.verification_status === 'VERIFIED') {
      score += 40;
    } else if (member.verification_status?.includes('PENDING')) {
      score += 20;
    }
    
    // Bonus for recent activity (having updated_at within last 30 days)
    if (member.updated_at) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      if (new Date(member.updated_at) > thirtyDaysAgo) {
        score += 20;
      }
    }
    
    return Math.min(Math.round(score), 100);
  }

  /**
   * Get pending approvals using existing admin endpoint
   */
  private async getPendingApprovals(): Promise<any[]> {
    try {
      console.log('ManagerService: Fetching pending approvals...');
      
      // Get team members first
      const teamMembers = await this.getTeamMembers();
      
      // Filter team members who have pending status
      const pendingMembers = teamMembers.filter(member => 
        member.verification_status && member.verification_status.includes('PENDING')
      );
      
      console.log(`ManagerService: Found ${pendingMembers.length} pending approvals`);
      return pendingMembers;
    } catch (error) {
      console.error('Failed to get pending approvals:', error);
      return [];
    }
  }

  /**
   * Generate recent activities from team member data
   */
  private generateRecentActivities(teamMembers: EmployeeData[]): Array<{
    type: string;
    description: string;
    timestamp: string;
    employee_name?: string;
  }> {
    const activities: Array<{
      type: string;
      description: string;
      timestamp: string;
      employee_name?: string;
    }> = [];

    // Generate activities from team member status changes
    teamMembers.forEach(member => {
      const memberName = `${member.first_name} ${member.last_name}`;
      
      if (member.verification_status?.includes('PENDING')) {
        activities.push({
          type: 'profile_review',
          description: 'Profile submitted for review',
          timestamp: member.updated_at || member.created_at || new Date().toISOString(),
          employee_name: memberName
        });
      }
      
      if (member.verification_status === 'VERIFIED') {
        activities.push({
          type: 'profile_approved',
          description: 'Profile verified and approved',
          timestamp: member.updated_at || member.created_at || new Date().toISOString(),
          employee_name: memberName
        });
      }
    });

    // Sort by timestamp and return most recent 5
    return activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5);
  }

  /**
   * Generate upcoming deadlines from team member data
   */
  private generateUpcomingDeadlines(teamMembers: EmployeeData[]): Array<{
    type: 'review' | 'goal' | 'document' | 'onboarding';
    description: string;
    due_date: string;
    employee_name: string;
  }> {
    const deadlines: Array<{
      type: 'review' | 'goal' | 'document' | 'onboarding';
      description: string;
      due_date: string;
      employee_name: string;
    }> = [];

    // Generate deadlines for onboarding completion
    teamMembers.forEach(member => {
      const memberName = `${member.first_name} ${member.last_name}`;
      
      // Add onboarding deadline for new hires (within 30 days of hire date)
      if (member.hired_at && member.verification_status !== 'VERIFIED') {
        const hireDate = new Date(member.hired_at);
        const onboardingDeadline = new Date(hireDate);
        onboardingDeadline.setDate(onboardingDeadline.getDate() + 30);
        
        // Only include if deadline is in the future
        if (onboardingDeadline > new Date()) {
          deadlines.push({
            type: 'onboarding',
            description: 'Complete onboarding process',
            due_date: onboardingDeadline.toISOString(),
            employee_name: memberName
          });
        }
      }

      // Add document review deadlines for pending documents
      if (member.verification_status?.includes('DOCUMENTS')) {
        const reviewDeadline = new Date();
        reviewDeadline.setDate(reviewDeadline.getDate() + 7); // 7 days to review documents
        
        deadlines.push({
          type: 'document',
          description: 'Review submitted documents',
          due_date: reviewDeadline.toISOString(),
          employee_name: memberName
        });
      }
    });

    // Sort by due date and return next 5
    return deadlines
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
      .slice(0, 5);
  }
}

// Create singleton instance
const managerService = new ManagerService();

export default managerService;