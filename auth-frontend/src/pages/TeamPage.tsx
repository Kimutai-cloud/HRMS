import React, { useState } from "react";
import { Search, Filter, Users, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import TeamMemberCard from "@/components/team/TeamMemberCard";
import TeamStats from "@/components/team/TeamStats";
import { ManagerRoute } from "@/components/auth/ProtectedRoute";
import { useTeamData } from "@/hooks";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export default function TeamPage() {
  const { user, isManager } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  
  const { members: teamMembers = [], loading: isLoading, error, refresh: refetch } = useTeamData();

  // Filter team members based on search and filters
  const filteredMembers = teamMembers.filter((member) => {
    const matchesSearch = 
      `${member.first_name} ${member.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.position?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || member.verification_status === statusFilter;
    const matchesDepartment = departmentFilter === "all" || member.department === departmentFilter;

    return matchesSearch && matchesStatus && matchesDepartment;
  });

  // Get unique departments for filter
  const departments = Array.from(new Set(teamMembers.map(member => member.department).filter(Boolean)));

  const handleViewProfile = (memberId: string) => {
    // Navigate to member profile or open modal
    toast({
      title: "View Profile",
      description: `Opening profile for member ${memberId}`,
    });
  };

  const handleEditDetails = (memberId: string) => {
    // Navigate to edit form or open modal
    toast({
      title: "Edit Details",
      description: `Opening edit form for member ${memberId}`,
    });
  };

  const handleSendMessage = (memberId: string) => {
    // Open messaging interface
    toast({
      title: "Send Message",
      description: `Opening message interface for member ${memberId}`,
    });
  };

  const handleApprove = async (memberId: string) => {
    // Handle approval
    toast({
      title: "Member Approved",
      description: "The team member has been approved successfully.",
    });
    refetch();
  };

  const handleReject = async (memberId: string) => {
    // Handle rejection
    toast({
      title: "Member Rejected",
      description: "The team member has been rejected.",
      variant: "destructive",
    });
    refetch();
  };

  const handleExportTeam = () => {
    // Export team data to CSV
    const csvData = filteredMembers.map(member => [
      member.first_name,
      member.last_name,
      member.email,
      member.position,
      member.department,
      member.verification_status,
      member.employment_type,
    ]);

    const headers = ['First Name', 'Last Name', 'Email', 'Position', 'Department', 'Status', 'Type'];
    const csvContent = [headers, ...csvData].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'team-members.csv';
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Export Successful",
      description: "Team data has been exported to CSV.",
    });
  };

  if (!isManager) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertDescription>
            You don't have permission to view team management. This page is only accessible to managers.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <ManagerRoute>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Team Management</h1>
            <p className="text-muted-foreground">
              Manage your team members and their information.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={() => refetch()}
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
            <Button 
              variant="outline" 
              onClick={handleExportTeam}
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </Button>
          </div>
        </div>

        {/* Team Stats */}
        <TeamStats />

        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
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

        {/* Team Members Grid */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-48 w-full rounded-lg" />
              </div>
            ))}
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertDescription>
              Failed to load team members. Please try again.
            </AlertDescription>
          </Alert>
        ) : filteredMembers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              {searchTerm || statusFilter !== "all" || departmentFilter !== "all" 
                ? "No team members match your filters" 
                : "No team members found"
              }
            </h3>
            <p className="text-sm text-muted-foreground">
              {searchTerm || statusFilter !== "all" || departmentFilter !== "all"
                ? "Try adjusting your search criteria"
                : "Add team members to get started"
              }
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredMembers.map((member) => (
              <TeamMemberCard
                key={member.id}
                member={member}
                onViewProfile={handleViewProfile}
                onEditDetails={handleEditDetails}
                onSendMessage={handleSendMessage}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))}
          </div>
        )}
      </div>
    </ManagerRoute>
  );
}