import React, { useState } from 'react';
import { 
  UserPlus, 
  Users, 
  Search, 
  Filter,
  MoreHorizontal,
  Edit,
  Trash2,
  Mail,
  MessageCircle,
  Calendar,
  Download,
  Upload,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useTeamMembers, useManagerDashboardMetrics } from '@/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { EmployeeData } from '@/types/auth';

interface TeamManagementPanelProps {
  managerId?: string;
  viewMode?: 'grid' | 'table';
  onViewModeChange?: (mode: 'grid' | 'table') => void;
}

const TeamManagementPanel: React.FC<TeamManagementPanelProps> = ({
  managerId,
  viewMode = 'table',
  onViewModeChange
}) => {
  const { user, isManager, isAdmin } = useAuth();
  const { toast } = useToast();
  const targetManagerId = managerId || user?.id;
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const {
    data: teamMembers = [],
    isLoading,
    error,
    refetch
  } = useTeamMembers(targetManagerId);

  const {
    data: metrics,
    isLoading: metricsLoading
  } = useManagerDashboardMetrics(targetManagerId);

  // Filtering logic
  const filteredMembers = teamMembers.filter((member) => {
    const matchesSearch = 
      `${member.first_name} ${member.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.position?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || member.verification_status === statusFilter;
    const matchesDepartment = departmentFilter === 'all' || member.department === departmentFilter;

    return matchesSearch && matchesStatus && matchesDepartment;
  });

  // Get unique departments
  const departments = Array.from(new Set(teamMembers.map(member => member.department).filter(Boolean)));

  const handleSelectMember = (memberId: string) => {
    setSelectedMembers(prev => 
      prev.includes(memberId) 
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleSelectAll = () => {
    if (selectedMembers.length === filteredMembers.length) {
      setSelectedMembers([]);
    } else {
      setSelectedMembers(filteredMembers.map(member => member.id));
    }
  };

  const handleBulkAction = (action: string) => {
    toast({
      title: `Bulk ${action}`,
      description: `${action} action applied to ${selectedMembers.length} team members.`,
    });
    setSelectedMembers([]);
  };

  const handleMemberAction = (action: string, memberId: string, memberName: string) => {
    toast({
      title: action,
      description: `Action "${action}" performed on ${memberName}`,
    });
  };

  const handleExportTeam = () => {
    const csvData = filteredMembers.map(member => [
      member.first_name,
      member.last_name,
      member.email || '',
      member.position || '',
      member.department || '',
      member.verification_status,
      member.employment_type || '',
    ]);

    const headers = ['First Name', 'Last Name', 'Email', 'Position', 'Department', 'Status', 'Type'];
    const csvContent = [headers, ...csvData].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `team-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Export Successful',
      description: 'Team data has been exported to CSV.',
    });
  };

  if (!isManager && !isAdmin) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          You don't have permission to access team management features.
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading || metricsLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>Failed to load team data. {error.message}</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Team Management</h2>
          <p className="text-muted-foreground">
            Manage your team members and track their progress
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExportTeam}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button>
            <UserPlus className="w-4 h-4 mr-2" />
            Add Member
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{teamMembers.length}</div>
                <div className="text-sm text-muted-foreground">Total Members</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <UserPlus className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {teamMembers.filter(m => m.verification_status === 'VERIFIED').length}
                </div>
                <div className="text-sm text-muted-foreground">Verified</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Calendar className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {teamMembers.filter(m => m.verification_status === 'PENDING_VERIFICATION').length}
                </div>
                <div className="text-sm text-muted-foreground">Pending</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search team members..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="VERIFIED">Verified</SelectItem>
                <SelectItem value="PENDING_VERIFICATION">Pending</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="NOT_STARTED">Not Started</SelectItem>
              </SelectContent>
            </Select>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Team Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Team Members ({filteredMembers.length})</CardTitle>
            {selectedMembers.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {selectedMembers.length} selected
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction('Send Message')}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Message
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction('Export')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <input
                    type="checkbox"
                    checked={selectedMembers.length === filteredMembers.length}
                    onChange={handleSelectAll}
                    className="rounded"
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedMembers.includes(member.id)}
                      onChange={() => handleSelectMember(member.id)}
                      className="rounded"
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {member.first_name} {member.last_name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {member.email}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{member.position}</TableCell>
                  <TableCell>{member.department}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        member.verification_status === 'VERIFIED' ? 'default' :
                        member.verification_status === 'PENDING_VERIFICATION' ? 'secondary' :
                        'destructive'
                      }
                    >
                      {member.verification_status?.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${member.profile_completion_percentage || 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {member.profile_completion_percentage || 0}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleMemberAction('View Profile', member.id, `${member.first_name} ${member.last_name}`)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          View Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleMemberAction('Send Message', member.id, `${member.first_name} ${member.last_name}`)}
                        >
                          <Mail className="h-4 w-4 mr-2" />
                          Send Message
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => handleMemberAction('Remove', member.id, `${member.first_name} ${member.last_name}`)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredMembers.length === 0 && (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                No team members found
              </h3>
              <p className="text-sm text-muted-foreground">
                {searchTerm || statusFilter !== 'all' || departmentFilter !== 'all'
                  ? "Try adjusting your filters"
                  : "Add team members to get started"
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TeamManagementPanel;