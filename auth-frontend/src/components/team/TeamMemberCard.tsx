import React from 'react';
import { 
  Mail, 
  Phone, 
  MapPin, 
  MoreHorizontal, 
  UserCheck, 
  UserX, 
  Edit, 
  MessageSquare,
  Calendar
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { format } from 'date-fns';
import type { EmployeeData } from '@/types/auth';

interface TeamMemberCardProps {
  member: EmployeeData;
  onViewProfile?: (memberId: string) => void;
  onEditDetails?: (memberId: string) => void;
  onSendMessage?: (memberId: string) => void;
  onApprove?: (memberId: string) => void;
  onReject?: (memberId: string) => void;
  showActions?: boolean;
}

const TeamMemberCard: React.FC<TeamMemberCardProps> = ({
  member,
  onViewProfile,
  onEditDetails,
  onSendMessage,
  onApprove,
  onReject,
  showActions = true,
}) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return <Badge className="bg-success text-success-foreground">Verified</Badge>;
      case 'PENDING_VERIFICATION':
        return <Badge className="bg-warning text-warning-foreground">Pending</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'NOT_STARTED':
        return <Badge variant="secondary">Not Started</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getEmploymentTypeBadge = (type: string) => {
    const badgeMap: { [key: string]: string } = {
      'full_time': 'Full Time',
      'part_time': 'Part Time',
      'contract': 'Contract',
      'intern': 'Intern',
    };
    return badgeMap[type] || type;
  };

  const initials = `${member.first_name?.[0] || ''}${member.last_name?.[0] || ''}`.toUpperCase();
  const fullName = `${member.first_name || ''} ${member.last_name || ''}`.trim();
  const profileCompletion = member.profile_completion_percentage || 0;

  return (
    <Card className="hover:shadow-md transition-all duration-200">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="w-12 h-12">
              <AvatarImage src={member.profile_image_url} />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-foreground">{fullName}</h3>
              <p className="text-sm text-muted-foreground">{member.position || 'No position'}</p>
            </div>
          </div>
          {showActions && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onViewProfile?.(member.id)}>
                  <UserCheck className="w-4 h-4 mr-2" />
                  View Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEditDetails?.(member.id)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSendMessage?.(member.id)}>
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Send Message
                </DropdownMenuItem>
                {member.verification_status === 'PENDING_VERIFICATION' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onApprove?.(member.id)}>
                      <UserCheck className="w-4 h-4 mr-2 text-green-600" />
                      Approve
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onReject?.(member.id)}>
                      <UserX className="w-4 h-4 mr-2 text-red-600" />
                      Reject
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Department and Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Department</span>
          <Badge variant="outline">{member.department || 'Unassigned'}</Badge>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Status</span>
          {getStatusBadge(member.verification_status)}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Type</span>
          <Badge variant="secondary">{getEmploymentTypeBadge(member.employment_type || 'full_time')}</Badge>
        </div>

        {/* Profile Completion */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Profile Completion</span>
            <span className="font-medium">{profileCompletion}%</span>
          </div>
          <Progress value={profileCompletion} className="h-2" />
        </div>

        {/* Contact Information */}
        <div className="space-y-2 pt-2 border-t">
          {member.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground truncate">{member.email}</span>
            </div>
          )}
          {member.phone_number && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">{member.phone_number}</span>
            </div>
          )}
          {(member.city || member.state) && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">
                {[member.city, member.state].filter(Boolean).join(', ')}
              </span>
            </div>
          )}
          {member.start_date && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">
                Started {format(new Date(member.start_date), 'MMM dd, yyyy')}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TeamMemberCard;