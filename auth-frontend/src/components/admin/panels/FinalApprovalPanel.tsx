import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  CheckCircle, 
  AlertTriangle,
  X,
  User,
  FileText,
  Settings,
  Shield,
  Calendar,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Clock,
  Eye,
  MessageSquare,
  Loader2,
  Award,
  Key,
  UserCheck
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface CompletedStage {
  stage: string;
  status: 'completed' | 'pending' | 'rejected';
  completed_at?: string;
  completed_by?: string;
  notes?: string;
}

interface EmployeeForFinalApproval {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string;
  position?: string;
  department?: string;
  employment_type?: string;
  work_location?: string;
  start_date?: string;
  hire_date?: string;
  profile_completion_percentage?: number;
  verification_status: string;
  
  // Stage completion data
  completed_stages: CompletedStage[];
  documents_summary?: {
    total_documents: number;
    approved_documents: number;
    pending_documents: number;
    rejected_documents: number;
  };
  assigned_roles: {
    id: string;
    name: string;
    code: string;
    level: string;
  }[];
  
  // Approval timeline
  approval_timeline?: {
    details_approved_at?: string;
    documents_approved_at?: string;
    roles_assigned_at?: string;
    submitted_for_final_at?: string;
  };
}

interface FinalApprovalPanelProps {
  employee: EmployeeForFinalApproval;
  onApprove: (notes: string, grantAccess: boolean) => Promise<void>;
  onReject: (reason: string) => Promise<void>;
  loading?: boolean;
  readOnly?: boolean;
  isProcessing?: boolean;
}

const FinalApprovalPanel: React.FC<FinalApprovalPanelProps> = ({
  employee,
  onApprove,
  onReject,
  loading = false,
  readOnly = false,
  isProcessing = false
}) => {
  const { toast } = useToast();
  const [notes, setNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [grantAccess, setGrantAccess] = useState(true);
  const [activeAction, setActiveAction] = useState<'approve' | 'reject' | null>(null);

  const handleApprove = async () => {
    try {
      await onApprove(notes, grantAccess);
      setNotes('');
      setActiveAction(null);
      toast({
        title: 'Final Approval Complete',
        description: `${employee.first_name} ${employee.last_name} has been fully approved and ${grantAccess ? 'granted system access' : 'approval recorded'}.`,
      });
    } catch (error) {
      toast({
        title: 'Approval Failed',
        description: error instanceof Error ? error.message : 'Failed to complete final approval',
        variant: 'destructive',
      });
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast({
        title: 'Rejection Reason Required',
        description: 'Please provide a reason for rejection.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await onReject(rejectionReason);
      setRejectionReason('');
      setActiveAction(null);
      toast({
        title: 'Final Approval Rejected',
        description: 'Employee has been rejected at final approval stage.',
      });
    } catch (error) {
      toast({
        title: 'Rejection Failed',
        description: error instanceof Error ? error.message : 'Failed to reject final approval',
        variant: 'destructive',
      });
    }
  };

  const getStageStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStageIcon = (stage: string) => {
    switch (stage.toLowerCase()) {
      case 'details':
        return <User className="w-4 h-4" />;
      case 'documents':
        return <FileText className="w-4 h-4" />;
      case 'roles':
        return <Settings className="w-4 h-4" />;
      case 'final':
        return <CheckCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const allStagesCompleted = employee.completed_stages.every(stage => stage.status === 'completed');
  const hasRejectedStages = employee.completed_stages.some(stage => stage.status === 'rejected');

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3">
              <Award className="w-6 h-6 text-purple-600" />
              Final Approval: {employee.first_name} {employee.last_name}
            </CardTitle>
            
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-sm">
                Profile {employee.profile_completion_percentage || 0}% Complete
              </Badge>
              <Badge className={allStagesCompleted ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                {allStagesCompleted ? 'Ready for Final Approval' : 'Stages Pending'}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Employee Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <UserCheck className="w-5 h-5" />
            Employee Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Personal Information
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3 h-3 text-muted-foreground" />
                    <span>{employee.email}</span>
                  </div>
                  {employee.phone_number && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3 h-3 text-muted-foreground" />
                      <span>{employee.phone_number}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Briefcase className="w-4 h-4" />
                  Employment Details
                </h4>
                <div className="space-y-2 text-sm">
                  <div><span className="font-medium">Position:</span> {employee.position || 'Not specified'}</div>
                  <div><span className="font-medium">Department:</span> {employee.department || 'Not specified'}</div>
                  <div><span className="font-medium">Type:</span> {employee.employment_type || 'Full-time'}</div>
                  <div><span className="font-medium">Location:</span> {employee.work_location || 'Not specified'}</div>
                  {employee.start_date && (
                    <div><span className="font-medium">Start Date:</span> {format(new Date(employee.start_date), 'MMM dd, yyyy')}</div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Documents Status
                </h4>
                {employee.documents_summary ? (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-lg font-bold text-green-600">{employee.documents_summary.approved_documents}</div>
                      <div className="text-muted-foreground">Approved</div>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-lg font-bold text-blue-600">{employee.documents_summary.total_documents}</div>
                      <div className="text-muted-foreground">Total</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No document information available</div>
                )}
              </div>

              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Assigned Roles
                </h4>
                <div className="space-y-2">
                  {employee.assigned_roles.length > 0 ? (
                    employee.assigned_roles.map(role => (
                      <div key={role.id} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                        <span className="font-medium">{role.name}</span>
                        <Badge className={
                          role.level === 'ADMIN' ? 'bg-purple-100 text-purple-800' :
                          role.level === 'HIGH' ? 'bg-red-100 text-red-800' :
                          role.level === 'MEDIUM' ? 'bg-orange-100 text-orange-800' :
                          'bg-blue-100 text-blue-800'
                        }>
                          {role.level}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground">No roles assigned</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stage Completion Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Approval Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {employee.completed_stages.map((stage, index) => (
              <div key={stage.stage} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    stage.status === 'completed' ? 'bg-green-100 text-green-600' :
                    stage.status === 'rejected' ? 'bg-red-100 text-red-600' :
                    'bg-yellow-100 text-yellow-600'
                  }`}>
                    {getStageIcon(stage.stage)}
                  </div>
                  
                  <div>
                    <div className="font-medium capitalize">{stage.stage} Review</div>
                    {stage.completed_at && (
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(stage.completed_at), 'MMM dd, yyyy HH:mm')}
                        {stage.completed_by && ` by ${stage.completed_by}`}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {getStageStatusBadge(stage.status)}
                  {stage.notes && (
                    <Button size="sm" variant="ghost">
                      <Eye className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Progress Summary */}
          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Overall Progress:</span>
              <span className="font-bold">
                {employee.completed_stages.filter(s => s.status === 'completed').length} / {employee.completed_stages.length} Completed
              </span>
            </div>
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${(employee.completed_stages.filter(s => s.status === 'completed').length / employee.completed_stages.length) * 100}%` 
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pre-approval Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Final Approval Checklist
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {allStagesCompleted ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
              )}
              <span className={allStagesCompleted ? 'text-green-700' : 'text-yellow-700'}>
                All required stages completed
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              {employee.profile_completion_percentage && employee.profile_completion_percentage >= 90 ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
              )}
              <span>Profile information complete</span>
            </div>
            
            <div className="flex items-center gap-3">
              {employee.documents_summary && employee.documents_summary.approved_documents > 0 ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
              )}
              <span>Documents reviewed and approved</span>
            </div>
            
            <div className="flex items-center gap-3">
              {employee.assigned_roles.length > 0 ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
              )}
              <span>Roles assigned appropriately</span>
            </div>
            
            <div className="flex items-center gap-3">
              {!hasRejectedStages ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <X className="w-5 h-5 text-red-600" />
              )}
              <span>No rejected stages requiring attention</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Final Approval Actions */}
      {!readOnly && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Final Approval Decision</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!activeAction ? (
              <div className="flex gap-3">
                <Button
                  onClick={() => setActiveAction('approve')}
                  disabled={loading || isProcessing || !allStagesCompleted}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Award className="w-4 h-4 mr-2" />
                  Grant Final Approval
                </Button>
                
                <Button
                  variant="destructive"
                  onClick={() => setActiveAction('reject')}
                  disabled={loading || isProcessing}
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Reject Final Approval
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {activeAction === 'approve' && (
                  <>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Final Approval Notes (Optional)</label>
                        <Textarea
                          placeholder="Add any final notes about this approval..."
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          className="min-h-[80px]"
                        />
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="grantAccess"
                          checked={grantAccess}
                          onChange={(e) => setGrantAccess(e.target.checked)}
                          className="rounded"
                        />
                        <label htmlFor="grantAccess" className="text-sm font-medium">
                          Grant immediate system access
                        </label>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button onClick={handleApprove} disabled={loading || isProcessing} className="bg-green-600 hover:bg-green-700">
                        {(loading || isProcessing) ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Award className="w-4 h-4 mr-2" />}
                        Complete Final Approval
                      </Button>
                      <Button variant="outline" onClick={() => setActiveAction(null)} disabled={loading || isProcessing}>
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  </>
                )}

                {activeAction === 'reject' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-2">Rejection Reason *</label>
                      <Textarea
                        placeholder="Explain why the final approval is being rejected..."
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        className="min-h-[100px] border-red-200 focus:border-red-400"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="destructive"
                        onClick={handleReject} 
                        disabled={loading || isProcessing || !rejectionReason.trim()}
                      >
                        {(loading || isProcessing) ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <AlertTriangle className="w-4 h-4 mr-2" />}
                        Confirm Rejection
                      </Button>
                      <Button variant="outline" onClick={() => setActiveAction(null)} disabled={loading || isProcessing}>
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Final Approval Guidelines */}
            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Final Approval Guidelines
              </h4>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>✓ Verify all previous stages have been completed successfully</p>
                <p>✓ Ensure employee information is accurate and complete</p>
                <p>✓ Confirm appropriate roles and permissions are assigned</p>
                <p>✓ Review any notes or concerns from previous reviewers</p>
                <p>✓ Final approval grants full system access and completes onboarding</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FinalApprovalPanel;