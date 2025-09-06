import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  CheckCircle, 
  XCircle, 
  Eye, 
  FileText, 
  User, 
  Calendar, 
  MapPin,
  Phone,
  Mail,
  Briefcase,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  useApproveEmployee, 
  useRejectEmployee, 
  useEmployeeProfile, 
  useEmployeeDocuments,
  // New stage-specific hooks
  useEmployeeForReview,
  useEmployeeDocumentsForReview,
  useApproveDetails,
  useApproveDocuments,
  useAssignRole,
  useFinalApprove,
  useRejectAtStage
} from '@/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { EmployeeData, DocumentStatus } from '@/types/auth';

const approvalSchema = z.object({
  action: z.enum(['approve', 'reject']),
  notes: z.string().optional(),
  rejectionReason: z.string().optional(),
});

type ApprovalFormData = z.infer<typeof approvalSchema>;

interface AdminApprovalFormProps {
  employee: EmployeeData;
  mode?: 'single' | 'batch';
  stage?: 'details' | 'documents' | 'roles' | 'final';
  onApprovalComplete?: (approved: boolean) => void;
  onStageComplete?: (stage: string, success: boolean) => void;
}

const AdminApprovalForm: React.FC<AdminApprovalFormProps> = ({
  employee,
  mode = 'single',
  stage,
  onApprovalComplete,
  onStageComplete,
}) => {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [showDocuments, setShowDocuments] = useState(false);

  // Use admin-specific hooks for detailed review data
  const { data: profileData } = useEmployeeForReview(employee.id);
  const { data: documents = [] } = useEmployeeDocumentsForReview(employee.id);
  
  // Stage-specific mutation hooks
  const approveDetailsMutation = useApproveDetails();
  const approveDocumentsMutation = useApproveDocuments();
  const assignRoleMutation = useAssignRole();
  const finalApproveMutation = useFinalApprove();
  const rejectAtStageMutation = useRejectAtStage();
  
  // Legacy hooks for backward compatibility
  const approveEmployeeMutation = useApproveEmployee();
  const rejectEmployeeMutation = useRejectEmployee();

  const form = useForm<ApprovalFormData>({
    resolver: zodResolver(approvalSchema),
    defaultValues: {
      action: 'approve',
      notes: '',
      rejectionReason: '',
    },
  });

  const watchedAction = form.watch('action');

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            You don't have permission to review employee profiles.
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleStageApprove = async (data: ApprovalFormData) => {
    try {
      let result;
      let stageTitle = '';
      
      // Determine which stage-specific approval to use
      if (stage === 'details') {
        result = await approveDetailsMutation.mutateAsync({
          employeeId: employee.id,
          notes: data.notes,
        });
        stageTitle = 'Details Approved';
      } else if (stage === 'documents') {
        result = await approveDocumentsMutation.mutateAsync({
          employeeId: employee.id,
          notes: data.notes,
        });
        stageTitle = 'Documents Approved';
      } else if (stage === 'roles') {
        // For role assignment, we'd need a role selector in the form
        // For now, default to EMPLOYEE role
        result = await assignRoleMutation.mutateAsync({
          employeeId: employee.id,
          roleCode: 'EMPLOYEE',
          notes: data.notes,
        });
        stageTitle = 'Role Assigned';
      } else if (stage === 'final') {
        result = await finalApproveMutation.mutateAsync({
          employeeId: employee.id,
          notes: data.notes,
        });
        stageTitle = 'Final Approval Complete';
      } else {
        // Fallback to legacy approval
        result = await approveEmployeeMutation.mutateAsync(employee.id);
        stageTitle = 'Employee Approved';
      }
      
      toast({
        title: stageTitle,
        description: `${employee.first_name} ${employee.last_name} has been approved${stage ? ` at ${stage} stage` : ''}.`,
      });
      
      onStageComplete?.(stage || 'unknown', true);
      onApprovalComplete?.(true);
    } catch (error) {
      toast({
        title: 'Approval Failed',
        description: error instanceof Error ? error.message : 'Failed to approve employee',
        variant: 'destructive',
      });
    }
  };

  const handleStageReject = async (data: ApprovalFormData) => {
    if (!data.rejectionReason) {
      form.setError('rejectionReason', {
        type: 'required',
        message: 'Rejection reason is required',
      });
      return;
    }

    try {
      if (stage) {
        // Use stage-specific rejection
        await rejectAtStageMutation.mutateAsync({
          employeeId: employee.id,
          reason: data.rejectionReason,
          stage: stage.toUpperCase(),
        });
      } else {
        // Fallback to legacy rejection
        await rejectEmployeeMutation.mutateAsync({
          employeeId: employee.id,
          reason: data.rejectionReason,
        });
      }
      
      toast({
        title: 'Employee Rejected',
        description: `${employee.first_name} ${employee.last_name} has been rejected${stage ? ` at ${stage} stage` : ''}.`,
      });
      
      onStageComplete?.(stage || 'unknown', false);
      onApprovalComplete?.(false);
    } catch (error) {
      toast({
        title: 'Rejection Failed',
        description: error instanceof Error ? error.message : 'Failed to reject employee',
        variant: 'destructive',
      });
    }
  };

  const onSubmit = async (data: ApprovalFormData) => {
    if (data.action === 'approve') {
      await handleStageApprove(data);
    } else {
      await handleStageReject(data);
    }
  };

  const getVerificationStatusBadge = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return <Badge variant="default" className="bg-green-500">Verified</Badge>;
      case 'PENDING_VERIFICATION':
        return <Badge variant="secondary">Pending Review</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">Not Started</Badge>;
    }
  };

  const getDocumentStatusIcon = (status: DocumentStatus['status']) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'pending':
        return <Eye className="w-4 h-4 text-yellow-500" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  const completionPercentage = employee.profile_completion_percentage || 0;
  const verifiedDocuments = documents.filter(doc => doc.status === 'approved').length;
  const totalDocuments = documents.length;

  return (
    <div className="space-y-6">
      {/* Employee Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">
                  {employee.first_name} {employee.last_name}
                </CardTitle>
                <CardDescription>
                  {employee.position} • {employee.department}
                </CardDescription>
              </div>
            </div>
            {getVerificationStatusBadge(employee.verification_status)}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Profile Completion */}
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium">Profile Completion</p>
                <p className="text-lg font-bold">{completionPercentage}%</p>
              </div>
            </div>

            {/* Documents */}
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <FileText className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium">Documents</p>
                <p className="text-lg font-bold">
                  {verifiedDocuments}/{totalDocuments} Verified
                </p>
              </div>
            </div>

            {/* Start Date */}
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <Calendar className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium">Start Date</p>
                <p className="text-lg font-bold">
                  {employee.start_date ? format(new Date(employee.start_date), 'MMM dd, yyyy') : 'Not set'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employee Details */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Personal Info */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <User className="w-4 h-4" />
                Personal Information
              </h4>
              <div className="space-y-2 text-sm">
                {employee.phone_number && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3 h-3 text-muted-foreground" />
                    <span>{employee.phone_number}</span>
                  </div>
                )}
                {employee.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-3 h-3 text-muted-foreground" />
                    <span>{employee.email}</span>
                  </div>
                )}
                {employee.address && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3 h-3 text-muted-foreground" />
                    <span>
                      {employee.address}, {employee.city}, {employee.state} 
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Employment Info */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                Employment Details
              </h4>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Position:</span> {employee.position}
                </div>
                <div>
                  <span className="font-medium">Department:</span> {employee.department}
                </div>
                <div>
                  <span className="font-medium">Type:</span> {employee.employment_type}
                </div>
                <div>
                  <span className="font-medium">Work Location:</span> {employee.work_location}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Uploaded Documents</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDocuments(!showDocuments)}
            >
              <Eye className="w-4 h-4 mr-2" />
              {showDocuments ? 'Hide' : 'View'} Documents
            </Button>
          </div>
        </CardHeader>
        {showDocuments && (
          <CardContent>
            {documents.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No documents uploaded yet
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      {getDocumentStatusIcon(doc.status)}
                      <div>
                        <p className="font-medium">{doc.document_type}</p>
                        <p className="text-xs text-muted-foreground">
                          Uploaded {format(new Date(doc.upload_date), 'MMM dd, yyyy')}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={
                        doc.status === 'approved' ? 'default' :
                        doc.status === 'pending' ? 'secondary' :
                        'destructive'
                      }
                    >
                      {doc.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Approval Form */}
      <Card>
        <CardHeader>
          <CardTitle>Review Decision</CardTitle>
          <CardDescription>
            Approve or reject this employee's profile and documentation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="action"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Decision</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select action" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="approve">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            Approve Employee
                          </div>
                        </SelectItem>
                        <SelectItem value="reject">
                          <div className="flex items-center gap-2">
                            <XCircle className="w-4 h-4 text-red-500" />
                            Reject Employee
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {watchedAction === 'reject' && (
                <FormField
                  control={form.control}
                  name="rejectionReason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rejection Reason *</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Please provide a clear reason for rejection..."
                          className="min-h-[100px]"
                        />
                      </FormControl>
                      <FormDescription>
                        This will be sent to the employee for review
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Any additional comments or instructions..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant={watchedAction === 'approve' ? 'default' : 'destructive'}
                      disabled={
                        approveDetailsMutation.isPending || 
                        approveDocumentsMutation.isPending ||
                        assignRoleMutation.isPending ||
                        finalApproveMutation.isPending ||
                        rejectAtStageMutation.isPending ||
                        approveEmployeeMutation.isPending || 
                        rejectEmployeeMutation.isPending
                      }
                    >
                      {(
                        approveDetailsMutation.isPending || 
                        approveDocumentsMutation.isPending ||
                        assignRoleMutation.isPending ||
                        finalApproveMutation.isPending ||
                        rejectAtStageMutation.isPending ||
                        approveEmployeeMutation.isPending || 
                        rejectEmployeeMutation.isPending
                      ) ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : watchedAction === 'approve' ? (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          {stage ? `Approve ${stage.charAt(0).toUpperCase() + stage.slice(1)}` : 'Approve Employee'}
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-4 h-4 mr-2" />
                          {stage ? `Reject at ${stage.charAt(0).toUpperCase() + stage.slice(1)}` : 'Reject Employee'}
                        </>
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {watchedAction === 'approve' ? 'Approve Employee?' : 'Reject Employee?'}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {watchedAction === 'approve' 
                          ? `Are you sure you want to approve ${employee.first_name} ${employee.last_name}? This will grant them full system access.`
                          : `Are you sure you want to reject ${employee.first_name} ${employee.last_name}? They will need to address the issues and resubmit.`
                        }
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={form.handleSubmit(onSubmit)}
                        className={watchedAction === 'approve' ? '' : 'bg-destructive hover:bg-destructive/80'}
                      >
                        {watchedAction === 'approve' ? 'Approve' : 'Reject'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminApprovalForm;