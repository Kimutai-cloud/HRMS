import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { 
  UserCheck, 
  FileCheck, 
  Settings, 
  CheckCircle,
  Clock,
  User,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { PendingReview } from '@/hooks/queries/useAdminQueries';

interface StageReviewListProps {
  stage: 'details' | 'documents' | 'roles' | 'final';
  reviews: PendingReview[];
  loading: boolean;
  onReviewEmployee: (employeeId: string) => void;
  onBulkAction?: (employeeIds: string[], action: 'approve' | 'reject') => void;
}

const StageReviewList: React.FC<StageReviewListProps> = ({
  stage,
  reviews,
  loading,
  onReviewEmployee,
  onBulkAction,
}) => {
  const { toast } = useToast();
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);

  const stageConfig = {
    details: {
      title: 'Details Review',
      icon: UserCheck,
      color: 'blue',
      description: 'Review employee profile information and basic details'
    },
    documents: {
      title: 'Documents Review', 
      icon: FileCheck,
      color: 'green',
      description: 'Review uploaded documents and verify completeness'
    },
    roles: {
      title: 'Role Assignment',
      icon: Settings,
      color: 'orange', 
      description: 'Assign appropriate roles and permissions'
    },
    final: {
      title: 'Final Approval',
      icon: CheckCircle,
      color: 'purple',
      description: 'Final verification and system access approval'
    }
  };

  const config = stageConfig[stage];
  const IconComponent = config.icon;

  const toggleEmployeeSelection = (employeeId: string) => {
    setSelectedEmployees(prev => 
      prev.includes(employeeId) 
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const handleBulkAction = (action: 'approve' | 'reject') => {
    if (selectedEmployees.length === 0) {
      toast({
        title: 'No Selection',
        description: 'Please select employees to perform bulk action',
        variant: 'destructive',
      });
      return;
    }

    onBulkAction?.(selectedEmployees, action);
    setSelectedEmployees([]);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800'; 
      case 'normal': return 'bg-blue-100 text-blue-800';
      case 'low': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <IconComponent className={`w-6 h-6 text-${config.color}-600`} />
            <div>
              <CardTitle>{config.title}</CardTitle>
              <p className="text-sm text-muted-foreground">{config.description}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span>Loading {config.title.toLowerCase()}...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <IconComponent className={`w-6 h-6 text-${config.color}-600`} />
            <div>
              <CardTitle>{config.title}</CardTitle>
              <p className="text-sm text-muted-foreground">{config.description}</p>
            </div>
          </div>
          <Badge variant="secondary">
            {reviews.length} pending
          </Badge>
        </div>

        {onBulkAction && selectedEmployees.length > 0 && (
          <div className="flex gap-2 pt-4 border-t">
            <Button
              size="sm"
              onClick={() => handleBulkAction('approve')}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Bulk Approve ({selectedEmployees.length})
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleBulkAction('reject')}
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Bulk Reject ({selectedEmployees.length})
            </Button>
          </div>
        )}
      </CardHeader>
      
      <CardContent>
        {reviews.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <IconComponent className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No employees pending {config.title.toLowerCase()}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => (
              <div
                key={review.employee.id}
                className="border rounded-lg p-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {onBulkAction && (
                      <input
                        type="checkbox"
                        checked={selectedEmployees.includes(review.employee.id)}
                        onChange={() => toggleEmployeeSelection(review.employee.id)}
                        className="rounded"
                      />
                    )}
                    
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    
                    <div>
                      <h4 className="font-semibold">
                        {review.employee.first_name} {review.employee.last_name}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {review.employee.position} • {review.employee.department}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right text-sm">
                      <Badge className={getPriorityColor(review.priority)}>
                        {review.priority}
                      </Badge>
                      <p className="text-muted-foreground mt-1">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {review.days_pending} days pending
                      </p>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => onReviewEmployee(review.employee.id)}
                    >
                      Review
                    </Button>
                  </div>
                </div>

                {stage === 'documents' && review.documents_summary && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex gap-4 text-sm">
                      <span>
                        <strong>{review.documents_summary.total_documents}</strong> total docs
                      </span>
                      <span className="text-green-600">
                        <strong>{review.documents_summary.approved_documents}</strong> approved
                      </span>
                      <span className="text-yellow-600">
                        <strong>{review.documents_summary.pending_documents}</strong> pending
                      </span>
                      <span className="text-red-600">
                        <strong>{review.documents_summary.rejected_documents}</strong> rejected
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StageReviewList;