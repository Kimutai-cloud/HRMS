import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  User, 
  MapPin, 
  Mail, 
  Phone, 
  Calendar, 
  Briefcase,
  CheckCircle,
  AlertTriangle,
  Edit,
  Save,
  X,
  Building,
  UserCheck,
  Clock,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface EmployeeDetails {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  title?: string;
  department?: string;
  manager_id?: string;
  verification_status?: string;
  hired_at?: string;
  created_at?: string;
  updated_at?: string;
}

interface DetailsReviewPanelProps {
  employee: EmployeeDetails;
  onApprove: (notes: string) => Promise<void>;
  onReject: (reason: string) => Promise<void>;
  onRequestChanges: (changes: string) => Promise<void>;
  loading?: boolean;
  readOnly?: boolean;
  isProcessing?: boolean;
}

const DetailsReviewPanel: React.FC<DetailsReviewPanelProps> = ({
  employee,
  onApprove,
  onReject,
  onRequestChanges,
  loading = false,
  readOnly = false,
  isProcessing = false
}) => {
  const { toast } = useToast();
  const [notes, setNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [changeRequests, setChangeRequests] = useState('');
  const [activeAction, setActiveAction] = useState<'approve' | 'reject' | 'changes' | null>(null);

  const handleApprove = async () => {
    try {
      await onApprove(notes);
      setNotes('');
      setActiveAction(null);
      toast({
        title: 'Details Approved',
        description: 'Employee details have been approved successfully.',
      });
    } catch (error) {
      toast({
        title: 'Approval Failed',
        description: error instanceof Error ? error.message : 'Failed to approve details',
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
        title: 'Details Rejected',
        description: 'Employee details have been rejected.',
      });
    } catch (error) {
      toast({
        title: 'Rejection Failed',
        description: error instanceof Error ? error.message : 'Failed to reject details',
        variant: 'destructive',
      });
    }
  };

  const handleRequestChanges = async () => {
    if (!changeRequests.trim()) {
      toast({
        title: 'Change Description Required',
        description: 'Please describe what changes are needed.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await onRequestChanges(changeRequests);
      setChangeRequests('');
      setActiveAction(null);
      toast({
        title: 'Change Request Sent',
        description: 'Employee has been notified of required changes.',
      });
    } catch (error) {
      toast({
        title: 'Request Failed',
        description: error instanceof Error ? error.message : 'Failed to request changes',
        variant: 'destructive',
      });
    }
  };



  const isFieldComplete = (value?: string) => value && value.trim().length > 0;

  const missingFields = [
    { field: 'phone', label: 'Phone Number', value: employee.phone },
    { field: 'title', label: 'Job Title', value: employee.title },
    { field: 'department', label: 'Department', value: employee.department },
  ].filter(item => !isFieldComplete(item.value));

  return (
    <div className="space-y-6">
      {/* Header with Profile Completion */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3">
              <UserCheck className="w-6 h-6 text-blue-600" />
              Details Review: {employee.first_name} {employee.last_name}
            </CardTitle>
            
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-sm">
                {employee.verification_status?.replace(/_/g, ' ') || 'Unknown Status'}
              </Badge>
              
              {missingFields.length === 0 ? (
                <div className="text-sm font-medium text-green-600">
                  All fields complete
                </div>
              ) : (
                <div className="text-sm font-medium text-yellow-600">
                  {missingFields.length} field{missingFields.length > 1 ? 's' : ''} missing
                </div>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Employee Information Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="w-5 h-5" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">First Name</label>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{employee.first_name}</span>
                  {isFieldComplete(employee.first_name) ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                  )}
                </div>
              </div>
              
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Last Name</label>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{employee.last_name}</span>
                  {isFieldComplete(employee.last_name) ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email Address
              </label>
              <div className="flex items-center gap-2">
                <span className="font-medium">{employee.email}</span>
                <CheckCircle className="w-4 h-4 text-green-600" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Phone Number
              </label>
              <div className="flex items-center gap-2">
                <span className={`font-medium ${!employee.phone ? 'text-muted-foreground italic' : ''}`}>
                  {employee.phone || 'Not provided'}
                </span>
                {isFieldComplete(employee.phone) ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                )}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Member Since
              </label>
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {employee.created_at ? format(new Date(employee.created_at), 'MMM dd, yyyy') : 'Unknown'}
                </span>
                <CheckCircle className="w-4 h-4 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Account Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Verification Status</label>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {employee.verification_status?.replace(/_/g, ' ') || 'Unknown'}
                </Badge>
                <CheckCircle className="w-4 h-4 text-green-600" />
              </div>
            </div>

            {employee.hired_at && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Hire Date</label>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{format(new Date(employee.hired_at), 'MMM dd, yyyy')}</span>
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Last Updated</label>
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {employee.updated_at ? format(new Date(employee.updated_at), 'MMM dd, yyyy h:mm a') : 'Unknown'}
                </span>
                <CheckCircle className="w-4 h-4 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Employment Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Briefcase className="w-5 h-5" />
              Employment Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Job Title</label>
              <div className="flex items-center gap-2">
                <span className={`font-medium ${!employee.title ? 'text-muted-foreground italic' : ''}`}>
                  {employee.title || 'Not specified'}
                </span>
                {isFieldComplete(employee.title) ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                )}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Department</label>
              <div className="flex items-center gap-2">
                <span className={`font-medium ${!employee.department ? 'text-muted-foreground italic' : ''}`}>
                  {employee.department || 'Not specified'}
                </span>
                {isFieldComplete(employee.department) ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                )}
              </div>
            </div>

            {employee.manager_id && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Building className="w-4 h-4" />
                  Manager Assigned
                </label>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Yes</span>
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
              </div>
            )}

            {employee.hire_date && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Hire Date</label>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{format(new Date(employee.hire_date), 'MMM dd, yyyy')}</span>
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Missing Information Alert */}
        {missingFields.length > 0 && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-yellow-800">
                <AlertTriangle className="w-5 h-5" />
                Incomplete Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-yellow-700 mb-3">
                The following fields are missing or incomplete:
              </p>
              <div className="space-y-1">
                {missingFields.map(field => (
                  <div key={field.field} className="text-sm text-yellow-600">
                    • {field.label}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Review Actions */}
      {!readOnly && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Review Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!activeAction ? (
              <div className="flex gap-3">
                <Button
                  onClick={() => setActiveAction('approve')}
                  disabled={loading || isProcessing}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve Details
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => setActiveAction('changes')}
                  disabled={loading || isProcessing}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Request Changes
                </Button>
                
                <Button
                  variant="destructive"
                  onClick={() => setActiveAction('reject')}
                  disabled={loading || isProcessing}
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Reject
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {activeAction === 'approve' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-2">Approval Notes (Optional)</label>
                      <Textarea
                        placeholder="Add any notes about this approval..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="min-h-[80px]"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleApprove} disabled={loading || isProcessing} className="bg-green-600 hover:bg-green-700">
                        {(loading || isProcessing) ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        Confirm Approval
                      </Button>
                      <Button variant="outline" onClick={() => setActiveAction(null)} disabled={loading || isProcessing}>
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  </>
                )}

                {activeAction === 'changes' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-2">Required Changes *</label>
                      <Textarea
                        placeholder="Describe what changes are needed..."
                        value={changeRequests}
                        onChange={(e) => setChangeRequests(e.target.value)}
                        className="min-h-[100px]"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        onClick={handleRequestChanges} 
                        disabled={loading || !changeRequests.trim()}
                        variant="outline"
                      >
                        {(loading || isProcessing) ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Edit className="w-4 h-4 mr-2" />}
                        Request Changes
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
                        placeholder="Explain why these details are being rejected..."
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        className="min-h-[100px] border-red-200 focus:border-red-400"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="destructive"
                        onClick={handleReject} 
                        disabled={loading || !rejectionReason.trim()}
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
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DetailsReviewPanel;