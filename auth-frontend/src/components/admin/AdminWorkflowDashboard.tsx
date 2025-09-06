import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { 
  UserCheck, 
  FileCheck, 
  Settings, 
  CheckCircle,
  ArrowLeft,
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import WorkflowStepper from './WorkflowStepper';
import StageCard from './StageCard';
import AdminReviewPanel from './AdminReviewPanel';
import {
  usePendingDetailsReviews,
  usePendingDocumentsReviews, 
  usePendingRoleAssignments,
  usePendingFinalApprovals,
  useEmployeeForReview,
  useBulkApproval,
  useBulkReject
} from '@/hooks';
import type { PendingReview } from '@/hooks/queries/useAdminQueries';

const AdminWorkflowDashboard: React.FC = () => {
  const { toast } = useToast();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<string>('details');
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  // Data queries
  const { data: detailsReviews = [], isLoading: detailsLoading } = usePendingDetailsReviews(20);
  const { data: documentsReviews = [], isLoading: documentsLoading } = usePendingDocumentsReviews(20);
  const { data: roleAssignments = [], isLoading: rolesLoading } = usePendingRoleAssignments(20);
  const { data: finalApprovals = [], isLoading: finalLoading } = usePendingFinalApprovals(20);

  // Selected employee data
  const { data: selectedEmployee } = useEmployeeForReview(selectedEmployeeId || '');

  // Mutations
  const bulkApprovalMutation = useBulkApproval();
  const bulkRejectMutation = useBulkReject();

  const handleReviewEmployee = (employeeId: string) => {
    // Employee selected for review
    setSelectedEmployeeId(employeeId);
  };

  const handleBackToList = () => {
    setSelectedEmployeeId(null);
  };

  const handleApprovalComplete = (approved: boolean) => {
    const action = approved ? 'approved' : 'rejected';
    toast({
      title: `Employee ${action}`,
      description: `The employee has been successfully ${action}.`,
    });
    setSelectedEmployeeId(null);
  };

  // Get current step data
  const getCurrentStepData = () => {
    switch (currentStep) {
      case 'details': return { reviews: detailsReviews, loading: detailsLoading, title: 'Details Review' };
      case 'documents': return { reviews: documentsReviews, loading: documentsLoading, title: 'Documents Review' };
      case 'roles': return { reviews: roleAssignments, loading: rolesLoading, title: 'Role Assignment' };
      case 'final': return { reviews: finalApprovals, loading: finalLoading, title: 'Final Approval' };
      default: return { reviews: detailsReviews, loading: detailsLoading, title: 'Details Review' };
    }
  };

  // Create steps array for stepper
  const steps = [
    {
      id: 'details',
      title: 'Details Review',
      description: 'Review employee information',
      icon: UserCheck,
      count: detailsReviews.length
    },
    {
      id: 'documents',
      title: 'Documents Review',
      description: 'Verify submitted documents',
      icon: FileCheck,
      count: documentsReviews.length
    },
    {
      id: 'roles',
      title: 'Role Assignment',
      description: 'Assign roles and permissions',
      icon: Settings,
      count: roleAssignments.length
    },
    {
      id: 'final',
      title: 'Final Approval',
      description: 'Complete verification process',
      icon: CheckCircle,
      count: finalApprovals.length
    }
  ];

  const handleEmployeeSelect = (employeeId: string) => {
    setSelectedEmployees(prev => 
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const handleSelectAll = () => {
    const { reviews } = getCurrentStepData();
    const allIds = reviews.map(review => review.employee_id);
    setSelectedEmployees(allIds);
  };

  const handleDeselectAll = () => {
    setSelectedEmployees([]);
  };


  const handleBulkAction = async (stage: string, employeeIds: string[], action: 'approve' | 'reject') => {
    try {
      if (action === 'approve') {
        await bulkApprovalMutation.mutateAsync({
          employeeIds,
          stage: stage.replace('s', '').toUpperCase(), // Convert to backend format
          notes: `Bulk approval from ${stage} stage`
        });
        
        toast({
          title: 'Bulk Approval Complete',
          description: `Successfully approved ${employeeIds.length} employees at ${stage} stage.`,
        });
      } else {
        await bulkRejectMutation.mutateAsync({
          employeeIds,
          reason: `Bulk rejection from ${stage} stage`,
          stage: stage.replace('s', '').toUpperCase()
        });
        
        toast({
          title: 'Bulk Rejection Complete', 
          description: `Successfully rejected ${employeeIds.length} employees at ${stage} stage.`,
        });
      }

      // Clear selections
      setSelectedEmployees([]);
    } catch (error) {
      toast({
        title: 'Bulk Action Failed',
        description: error instanceof Error ? error.message : 'Failed to perform bulk action',
        variant: 'destructive',
      });
    }
  };


  // If viewing individual employee
  if (selectedEmployeeId && selectedEmployee) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={handleBackToList}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to List
          </Button>
          <h2 className="text-2xl font-bold">
            Review: {selectedEmployee.first_name} {selectedEmployee.last_name}
          </h2>
        </div>

        <AdminReviewPanel
          employeeId={selectedEmployeeId}
          stage={currentStep as 'details' | 'documents' | 'roles' | 'final'}
          onComplete={handleApprovalComplete}
        />
      </div>
    );
  }

  const { reviews, loading, title } = getCurrentStepData();

  return (
    <div className="relative space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Employee Approval Workflow</h2>
        <p className="text-muted-foreground">
          Step through the 4-stage employee verification and approval process
        </p>
      </div>

      <WorkflowStepper
        currentStep={currentStep}
        onStepChange={setCurrentStep}
        steps={steps}
      />

      <div className="max-w-4xl">
        <StageCard
          stage={currentStep as 'details' | 'documents' | 'roles' | 'final'}
          title={title}
          reviews={reviews}
          loading={loading}
          selectedEmployees={selectedEmployees}
          searchQuery={searchQuery}
          priorityFilter={priorityFilter}
          onEmployeeSelect={handleEmployeeSelect}
          onEmployeeReview={handleReviewEmployee}
          onBulkAction={(employeeIds, action) => handleBulkAction(currentStep, employeeIds, action)}
          onSearchChange={setSearchQuery}
          onPriorityFilter={setPriorityFilter}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
        />
      </div>

      {/* Loading states for mutations - positioned relative to avoid layout interference */}
      {(bulkApprovalMutation.isPending || bulkRejectMutation.isPending) && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>Processing bulk action...</span>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminWorkflowDashboard;