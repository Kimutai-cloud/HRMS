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
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  CheckCircle, 
  XCircle, 
  Archive, 
  Users, 
  User,
  Loader2,
  AlertTriangle,
  Filter,
  Download,
  Upload as UploadIcon,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { useAllEmployees } from '@/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { EmployeeData } from '@/types/auth';

const bulkActionSchema = z.object({
  action: z.enum(['approve', 'reject', 'archive', 'export']),
  reason: z.string().optional(),
  employeeIds: z.array(z.string()).min(1, 'Please select at least one employee'),
});

type BulkActionFormData = z.infer<typeof bulkActionSchema>;

interface BulkOperationsPanelProps {
  onActionComplete?: (action: string, count: number) => void;
}

const BulkOperationsPanel: React.FC<BulkOperationsPanelProps> = ({
  onActionComplete,
}) => {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: employees = [], isLoading } = useAllEmployees();

  const form = useForm<BulkActionFormData>({
    resolver: zodResolver(bulkActionSchema),
    defaultValues: {
      action: 'approve',
      reason: '',
      employeeIds: [],
    },
  });

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            You don't have permission to perform bulk operations.
          </div>
        </CardContent>
      </Card>
    );
  }

  // Filter employees based on status
  const filteredEmployees = employees.filter((employee) => {
    if (filterStatus === 'all') return true;
    return employee.verification_status === filterStatus;
  });

  const handleSelectAll = () => {
    if (selectedEmployees.length === filteredEmployees.length) {
      setSelectedEmployees([]);
    } else {
      setSelectedEmployees(filteredEmployees.map(emp => emp.id));
    }
  };

  const handleSelectEmployee = (employeeId: string) => {
    setSelectedEmployees(prev =>
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return <Badge variant="default" className="bg-green-500">Verified</Badge>;
      case 'PENDING_VERIFICATION':
        return <Badge variant="secondary">Pending</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">Not Started</Badge>;
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'approve':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'reject':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'archive':
        return <Archive className="w-4 h-4 text-gray-500" />;
      case 'export':
        return <Download className="w-4 h-4 text-blue-500" />;
      default:
        return <Users className="w-4 h-4" />;
    }
  };

  const getActionDescription = (action: string, count: number) => {
    switch (action) {
      case 'approve':
        return `Approve ${count} employee${count > 1 ? 's' : ''}? This will grant them full system access.`;
      case 'reject':
        return `Reject ${count} employee${count > 1 ? 's' : ''}? They will need to address issues and resubmit.`;
      case 'archive':
        return `Archive ${count} employee${count > 1 ? 's' : ''}? This will hide them from active employee lists.`;
      case 'export':
        return `Export data for ${count} employee${count > 1 ? 's' : ''} to CSV format?`;
      default:
        return '';
    }
  };

  const handleBulkAction = async (data: BulkActionFormData) => {
    if (selectedEmployees.length === 0) {
      form.setError('employeeIds', {
        type: 'required',
        message: 'Please select at least one employee',
      });
      return;
    }

    if (data.action === 'reject' && !data.reason) {
      form.setError('reason', {
        type: 'required',
        message: 'Reason is required for rejection',
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Mock API calls - replace with actual implementation
      switch (data.action) {
        case 'approve':
          // Bulk approve logic
          await new Promise(resolve => setTimeout(resolve, 2000));
          toast({
            title: 'Bulk Approval Successful',
            description: `${selectedEmployees.length} employees have been approved.`,
          });
          break;
        
        case 'reject':
          // Bulk reject logic
          await new Promise(resolve => setTimeout(resolve, 2000));
          toast({
            title: 'Bulk Rejection Successful',
            description: `${selectedEmployees.length} employees have been rejected.`,
          });
          break;
        
        case 'archive':
          // Bulk archive logic
          await new Promise(resolve => setTimeout(resolve, 2000));
          toast({
            title: 'Bulk Archive Successful',
            description: `${selectedEmployees.length} employees have been archived.`,
          });
          break;
        
        case 'export':
          // Export logic
          const selectedEmployeeData = employees.filter(emp => selectedEmployees.includes(emp.id));
          const csvContent = generateCSV(selectedEmployeeData);
          downloadCSV(csvContent, 'employees-export.csv');
          toast({
            title: 'Export Successful',
            description: `Data for ${selectedEmployees.length} employees has been exported.`,
          });
          break;
      }

      setSelectedEmployees([]);
      form.reset();
      onActionComplete?.(data.action, selectedEmployees.length);
    } catch (error) {
      toast({
        title: 'Operation Failed',
        description: error instanceof Error ? error.message : 'Bulk operation failed',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const generateCSV = (employeeData: EmployeeData[]): string => {
    const headers = [
      'ID',
      'First Name',
      'Last Name',
      'Email',
      'Position',
      'Department',
      'Status',
      'Start Date',
      'Profile Completion'
    ];

    const rows = employeeData.map(emp => [
      emp.id,
      emp.first_name,
      emp.last_name,
      emp.email || '',
      emp.position || '',
      emp.department || '',
      emp.verification_status,
      emp.start_date ? format(new Date(emp.start_date), 'yyyy-MM-dd') : '',
      `${emp.profile_completion_percentage || 0}%`
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  };

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="space-y-6">
      {/* Bulk Actions Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Bulk Operations
              </CardTitle>
              <CardDescription>
                Perform actions on multiple employees at once
              </CardDescription>
            </div>
            <Badge variant="outline">
              {selectedEmployees.length} selected
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleBulkAction)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="action"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Action</FormLabel>
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
                              Bulk Approve
                            </div>
                          </SelectItem>
                          <SelectItem value="reject">
                            <div className="flex items-center gap-2">
                              <XCircle className="w-4 h-4 text-red-500" />
                              Bulk Reject
                            </div>
                          </SelectItem>
                          <SelectItem value="archive">
                            <div className="flex items-center gap-2">
                              <Archive className="w-4 h-4 text-gray-500" />
                              Bulk Archive
                            </div>
                          </SelectItem>
                          <SelectItem value="export">
                            <div className="flex items-center gap-2">
                              <Download className="w-4 h-4 text-blue-500" />
                              Export Data
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="text-sm font-medium">Filter by Status</label>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Employees</SelectItem>
                        <SelectItem value="PENDING_VERIFICATION">Pending Review</SelectItem>
                        <SelectItem value="VERIFIED">Verified</SelectItem>
                        <SelectItem value="REJECTED">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSelectAll}
                    disabled={filteredEmployees.length === 0}
                  >
                    {selectedEmployees.length === filteredEmployees.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
              </div>

              {form.watch('action') === 'reject' && (
                <FormField
                  control={form.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rejection Reason *</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Provide a clear reason for bulk rejection..."
                          className="min-h-[80px]"
                        />
                      </FormControl>
                      <FormDescription>
                        This reason will be applied to all rejected employees
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="flex justify-end">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      disabled={selectedEmployees.length === 0 || isProcessing}
                      variant={
                        form.watch('action') === 'reject' ? 'destructive' :
                        form.watch('action') === 'approve' ? 'default' : 'secondary'
                      }
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          {getActionIcon(form.watch('action'))}
                          <span className="ml-2">
                            Execute Action ({selectedEmployees.length})
                          </span>
                        </>
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-warning" />
                        Confirm Bulk Action
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {getActionDescription(form.watch('action'), selectedEmployees.length)}
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={form.handleSubmit(handleBulkAction)}
                        className={
                          form.watch('action') === 'reject' ? 'bg-destructive hover:bg-destructive/80' : ''
                        }
                      >
                        Confirm Action
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Employee List */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Selection</CardTitle>
          <CardDescription>
            Select employees for bulk operations ({filteredEmployees.length} shown)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-8 h-8 animate-spin mr-2" />
              <span>Loading employees...</span>
            </div>
          ) : (
            <ScrollArea className="h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedEmployees.length === filteredEmployees.length && filteredEmployees.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Completion</TableHead>
                    <TableHead>Start Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedEmployees.includes(employee.id)}
                          onCheckedChange={() => handleSelectEmployee(employee.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{employee.first_name} {employee.last_name}</p>
                            <p className="text-xs text-muted-foreground">{employee.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{employee.position || '—'}</TableCell>
                      <TableCell>{employee.department || '—'}</TableCell>
                      <TableCell>{getStatusBadge(employee.verification_status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full"
                              style={{ width: `${employee.profile_completion_percentage || 0}%` }}
                            />
                          </div>
                          <span className="text-xs">{employee.profile_completion_percentage || 0}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {employee.start_date 
                          ? format(new Date(employee.start_date), 'MMM dd, yyyy')
                          : '—'
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BulkOperationsPanel;