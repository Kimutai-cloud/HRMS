import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  Settings, 
  User, 
  Shield, 
  CheckCircle,
  AlertTriangle,
  X,
  Users,
  Lock,
  Eye,
  Edit,
  Crown,
  Briefcase,
  UserCheck,
  MessageSquare,
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Role {
  id: string;
  code: string;
  name: string;
  description?: string;
  permissions: string[];
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'ADMIN';
}

interface EmployeeRole {
  id: string;
  first_name: string;
  last_name: string;
  position?: string;
  department?: string;
  email: string;
  current_roles: Role[];
  recommended_roles: Role[];
  available_roles: Role[];
}

interface RolesReviewPanelProps {
  employee: EmployeeRole;
  onApprove: (assignedRoles: string[], notes: string) => Promise<void>;
  onReject: (reason: string) => Promise<void>;
  loading?: boolean;
  readOnly?: boolean;
  isProcessing?: boolean;
}

const RolesReviewPanel: React.FC<RolesReviewPanelProps> = ({
  employee,
  onApprove,
  onReject,
  loading = false,
  readOnly = false,
  isProcessing = false
}) => {
  const { toast } = useToast();
  const [selectedRoles, setSelectedRoles] = useState<string[]>(
    employee.recommended_roles.map(r => r.id)
  );
  const [notes, setNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [activeAction, setActiveAction] = useState<'approve' | 'reject' | null>(null);

  const handleApprove = async () => {
    if (selectedRoles.length === 0) {
      toast({
        title: 'No Roles Selected',
        description: 'Please select at least one role to assign.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await onApprove(selectedRoles, notes);
      setNotes('');
      setActiveAction(null);
      toast({
        title: 'Roles Approved',
        description: 'Employee roles have been assigned successfully.',
      });
    } catch (error) {
      toast({
        title: 'Assignment Failed',
        description: error instanceof Error ? error.message : 'Failed to assign roles',
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
        title: 'Role Assignment Rejected',
        description: 'Role assignment has been rejected.',
      });
    } catch (error) {
      toast({
        title: 'Rejection Failed',
        description: error instanceof Error ? error.message : 'Failed to reject role assignment',
        variant: 'destructive',
      });
    }
  };

  const toggleRole = (roleId: string) => {
    setSelectedRoles(prev =>
      prev.includes(roleId)
        ? prev.filter(id => id !== roleId)
        : [...prev, roleId]
    );
  };

  const getRoleIcon = (level: string) => {
    switch (level) {
      case 'ADMIN':
        return <Crown className="w-4 h-4 text-purple-600" />;
      case 'HIGH':
        return <Shield className="w-4 h-4 text-red-600" />;
      case 'MEDIUM':
        return <UserCheck className="w-4 h-4 text-orange-600" />;
      case 'LOW':
        return <User className="w-4 h-4 text-blue-600" />;
      default:
        return <User className="w-4 h-4 text-gray-600" />;
    }
  };

  const getRoleLevelBadge = (level: string) => {
    const colorMap = {
      'ADMIN': 'bg-purple-100 text-purple-800',
      'HIGH': 'bg-red-100 text-red-800',
      'MEDIUM': 'bg-orange-100 text-orange-800',
      'LOW': 'bg-blue-100 text-blue-800'
    };

    return (
      <Badge className={colorMap[level as keyof typeof colorMap] || 'bg-gray-100 text-gray-800'}>
        {level}
      </Badge>
    );
  };

  const getPositionBasedRecommendations = () => {
    const position = employee.position?.toLowerCase() || '';
    const department = employee.department?.toLowerCase() || '';
    
    if (position.includes('manager') || position.includes('lead')) {
      return ['MANAGER', 'EMPLOYEE'];
    } else if (position.includes('admin') || department.includes('admin')) {
      return ['ADMIN'];
    } else if (position.includes('hr')) {
      return ['HR_SPECIALIST', 'EMPLOYEE'];
    } else {
      return ['EMPLOYEE'];
    }
  };

  const positionRecommendations = getPositionBasedRecommendations();

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-orange-600" />
            Role Assignment: {employee.first_name} {employee.last_name}
          </CardTitle>
        </CardHeader>
        
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                Employee Information
              </h4>
              <div className="space-y-2 text-sm">
                <div><span className="font-medium">Position:</span> {employee.position || 'Not specified'}</div>
                <div><span className="font-medium">Department:</span> {employee.department || 'Not specified'}</div>
                <div><span className="font-medium">Email:</span> {employee.email}</div>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Current Status
              </h4>
              <div className="space-y-2">
                <div className="text-sm">
                  <span className="font-medium">Current Roles:</span> {employee.current_roles.length || 0}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Recommended Roles:</span> {employee.recommended_roles.length}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Available Roles:</span> {employee.available_roles.length}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Roles */}
      {employee.current_roles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserCheck className="w-5 h-5" />
              Current Roles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {employee.current_roles.map((role) => (
                <div key={role.id} className="p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getRoleIcon(role.level)}
                      <span className="font-medium">{role.name}</span>
                    </div>
                    {getRoleLevelBadge(role.level)}
                  </div>
                  {role.description && (
                    <p className="text-sm text-muted-foreground mb-2">{role.description}</p>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {role.permissions.length} permissions
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Role Assignment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Role Assignment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Recommended Roles */}
          {employee.recommended_roles.length > 0 && (
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2 text-green-700">
                <CheckCircle className="w-4 h-4" />
                Recommended Roles (Based on Position & Department)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {employee.recommended_roles.map((role) => (
                  <div 
                    key={role.id} 
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      selectedRoles.includes(role.id) 
                        ? 'border-green-500 bg-green-50' 
                        : 'border-green-200 hover:border-green-300'
                    } ${readOnly ? 'cursor-default' : ''}`}
                    onClick={() => !readOnly && toggleRole(role.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getRoleIcon(role.level)}
                        <span className="font-medium">{role.name}</span>
                        {selectedRoles.includes(role.id) && (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        )}
                      </div>
                      {getRoleLevelBadge(role.level)}
                    </div>
                    {role.description && (
                      <p className="text-sm text-muted-foreground mb-2">{role.description}</p>
                    )}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{role.permissions.length} permissions</span>
                      <span className="text-green-600 font-medium">Recommended</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Other Available Roles */}
          {employee.available_roles.length > 0 && (
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Other Available Roles
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {employee.available_roles.map((role) => (
                  <div 
                    key={role.id} 
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                      selectedRoles.includes(role.id) 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    } ${readOnly ? 'cursor-default' : ''}`}
                    onClick={() => !readOnly && toggleRole(role.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getRoleIcon(role.level)}
                        <span className="font-medium">{role.name}</span>
                        {selectedRoles.includes(role.id) && (
                          <CheckCircle className="w-4 h-4 text-blue-600" />
                        )}
                      </div>
                      {getRoleLevelBadge(role.level)}
                    </div>
                    {role.description && (
                      <p className="text-sm text-muted-foreground mb-2">{role.description}</p>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {role.permissions.length} permissions
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Selected Roles Summary */}
          {selectedRoles.length > 0 && (
            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium mb-2 flex items-center gap-2 text-blue-800">
                <Shield className="w-4 h-4" />
                Selected Roles ({selectedRoles.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {selectedRoles.map(roleId => {
                  const role = [...employee.recommended_roles, ...employee.available_roles]
                    .find(r => r.id === roleId);
                  return role ? (
                    <Badge key={roleId} className="bg-blue-100 text-blue-800">
                      {getRoleIcon(role.level)}
                      <span className="ml-1">{role.name}</span>
                    </Badge>
                  ) : null;
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Actions */}
      {!readOnly && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Role Assignment Review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!activeAction ? (
              <div className="flex gap-3">
                <Button
                  onClick={() => setActiveAction('approve')}
                  disabled={loading || selectedRoles.length === 0}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve Role Assignment
                </Button>
                
                <Button
                  variant="destructive"
                  onClick={() => setActiveAction('reject')}
                  disabled={loading || isProcessing}
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Reject Assignment
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {activeAction === 'approve' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-2">Assignment Notes (Optional)</label>
                      <Textarea
                        placeholder="Add any notes about this role assignment..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="min-h-[80px]"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleApprove} disabled={loading || isProcessing} className="bg-green-600 hover:bg-green-700">
                        {(loading || isProcessing) ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                        Confirm Assignment
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
                        placeholder="Explain why the role assignment is being rejected..."
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

            {/* Role Assignment Guidelines */}
            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Role Assignment Guidelines
              </h4>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>✓ Consider employee's position and department when assigning roles</p>
                <p>✓ Start with basic employee access, add specialized roles as needed</p>
                <p>✓ Avoid over-privileging - assign minimum necessary permissions</p>
                <p>✓ Manager roles should only be assigned to leadership positions</p>
                <p>✓ Admin roles require special approval and justification</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RolesReviewPanel;