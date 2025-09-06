import React from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  X, 
  AlertTriangle, 
  Users, 
  FileCheck, 
  MessageSquare,
  Download,
  Settings,
  Trash2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface BulkSelectionToolbarProps {
  selectedCount: number;
  stage?: 'details' | 'documents' | 'roles' | 'final';
  onBulkApprove: () => void;
  onBulkReject: () => void;
  onDeselectAll: () => void;
  onBulkAssignRole?: () => void;
  onBulkDownload?: () => void;
  onBulkComment?: () => void;
}

const BulkSelectionToolbar: React.FC<BulkSelectionToolbarProps> = ({
  selectedCount,
  stage = 'details',
  onBulkApprove,
  onBulkReject,
  onDeselectAll,
  onBulkAssignRole,
  onBulkDownload,
  onBulkComment,
}) => {
  const stageConfig = {
    details: {
      primaryAction: 'Approve Details',
      rejectAction: 'Reject Details',
      icon: Users,
      color: 'blue'
    },
    documents: {
      primaryAction: 'Approve Documents',
      rejectAction: 'Reject Documents',
      icon: FileCheck,
      color: 'green'
    },
    roles: {
      primaryAction: 'Approve Roles',
      rejectAction: 'Reject Roles',
      icon: Settings,
      color: 'orange'
    },
    final: {
      primaryAction: 'Final Approval',
      rejectAction: 'Final Rejection',
      icon: CheckCircle,
      color: 'purple'
    }
  };

  const config = stageConfig[stage];
  const IconComponent = config.icon;

  return (
    <Card className="border-2 border-primary/20 bg-primary/5">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          {/* Selection Info */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <IconComponent className={`w-5 h-5 text-${config.color}-600`} />
              <Badge variant="secondary" className="text-sm">
                {selectedCount} selected
              </Badge>
            </div>
            <span className="text-sm text-muted-foreground">
              Ready for bulk actions
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Primary Actions */}
            <Button
              size="sm"
              onClick={onBulkApprove}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              {config.primaryAction}
            </Button>

            <Button
              size="sm"
              variant="destructive"
              onClick={onBulkReject}
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              {config.rejectAction}
            </Button>

            {/* Additional Actions Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  More Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {stage === 'roles' && onBulkAssignRole && (
                  <>
                    <DropdownMenuItem onClick={onBulkAssignRole}>
                      <Settings className="w-4 h-4 mr-2" />
                      Bulk Assign Role
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}

                {stage === 'documents' && onBulkDownload && (
                  <>
                    <DropdownMenuItem onClick={onBulkDownload}>
                      <Download className="w-4 h-4 mr-2" />
                      Download Selected Documents
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}

                {onBulkComment && (
                  <DropdownMenuItem onClick={onBulkComment}>
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Add Bulk Comment
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />
                
                <DropdownMenuItem
                  onClick={onDeselectAll}
                  className="text-muted-foreground"
                >
                  <X className="w-4 h-4 mr-2" />
                  Deselect All
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Deselect Button */}
            <Button
              size="sm"
              variant="ghost"
              onClick={onDeselectAll}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Progress Indicator */}
        <div className="mt-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex-1 bg-muted rounded-full h-2">
              <div 
                className={`h-2 bg-${config.color}-500 rounded-full transition-all duration-300`}
                style={{ width: `${Math.min((selectedCount / 10) * 100, 100)}%` }}
              />
            </div>
            <span>
              {selectedCount < 5 ? 'Getting started' : selectedCount < 10 ? 'Good selection' : 'Large batch'}
            </span>
          </div>
        </div>

        {/* Stage-specific Tips */}
        {selectedCount > 0 && (
          <div className="mt-3 p-3 bg-muted/50 rounded-lg">
            <div className="text-xs text-muted-foreground">
              {stage === 'details' && (
                <p>💡 <strong>Details Review:</strong> Verify employee information is complete and accurate before approval.</p>
              )}
              {stage === 'documents' && (
                <p>💡 <strong>Document Review:</strong> Check that all required documents are uploaded and valid.</p>
              )}
              {stage === 'roles' && (
                <p>💡 <strong>Role Assignment:</strong> Ensure appropriate roles are assigned based on position and department.</p>
              )}
              {stage === 'final' && (
                <p>💡 <strong>Final Approval:</strong> This will complete the onboarding process and grant system access.</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BulkSelectionToolbar;