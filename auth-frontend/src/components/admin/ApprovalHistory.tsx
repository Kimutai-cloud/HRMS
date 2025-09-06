import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { 
  History,
  CheckCircle,
  X,
  Clock,
  User,
  MessageSquare,
  Calendar,
  Filter,
  Download,
  Search,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  FileText,
  Settings,
  RefreshCw
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Input } from '@/components/ui/Input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface ApprovalHistoryEntry {
  id: string;
  employee_id: string;
  employee_name: string;
  stage: 'details' | 'documents' | 'roles' | 'final';
  action: 'approved' | 'rejected' | 'pending' | 'reassigned';
  timestamp: string;
  performed_by: string;
  notes?: string;
  reason?: string;
  metadata?: {
    previous_stage?: string;
    documents_count?: number;
    role_assigned?: string;
    priority?: string;
  };
}

interface ApprovalHistoryProps {
  entries: ApprovalHistoryEntry[];
  loading?: boolean;
  onRefresh?: () => void;
  onExport?: () => void;
  employeeId?: string; // Filter by specific employee
  title?: string;
}

const ApprovalHistory: React.FC<ApprovalHistoryProps> = ({
  entries,
  loading = false,
  onRefresh,
  onExport,
  employeeId,
  title = "Approval History"
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

  const stageConfig = {
    details: { label: 'Details Review', icon: User, color: 'blue' },
    documents: { label: 'Documents Review', icon: FileText, color: 'green' },
    roles: { label: 'Role Assignment', icon: Settings, color: 'orange' },
    final: { label: 'Final Approval', icon: CheckCircle, color: 'purple' }
  };

  const actionConfig = {
    approved: { label: 'Approved', color: 'green', icon: CheckCircle },
    rejected: { label: 'Rejected', color: 'red', icon: X },
    pending: { label: 'Pending', color: 'yellow', icon: Clock },
    reassigned: { label: 'Reassigned', color: 'blue', icon: RefreshCw }
  };

  // Filter entries
  const filteredEntries = entries.filter(entry => {
    const matchesSearch = !searchQuery || 
      entry.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.performed_by.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.notes?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStage = stageFilter === 'all' || entry.stage === stageFilter;
    const matchesAction = actionFilter === 'all' || entry.action === actionFilter;

    return matchesSearch && matchesStage && matchesAction;
  });

  const toggleExpanded = (entryId: string) => {
    const newExpanded = new Set(expandedEntries);
    if (newExpanded.has(entryId)) {
      newExpanded.delete(entryId);
    } else {
      newExpanded.add(entryId);
    }
    setExpandedEntries(newExpanded);
  };

  const getActionBadge = (action: string) => {
    const config = actionConfig[action as keyof typeof actionConfig];
    if (!config) return <Badge variant="secondary">{action}</Badge>;

    const colorClasses = {
      green: 'bg-green-100 text-green-800',
      red: 'bg-red-100 text-red-800',
      yellow: 'bg-yellow-100 text-yellow-800',
      blue: 'bg-blue-100 text-blue-800'
    };

    return (
      <Badge className={colorClasses[config.color]}>
        <config.icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const getStageBadge = (stage: string) => {
    const config = stageConfig[stage as keyof typeof stageConfig];
    if (!config) return <Badge variant="outline">{stage}</Badge>;

    return (
      <Badge variant="outline">
        <config.icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            {title}
            <Badge variant="secondary">{filteredEntries.length} entries</Badge>
          </CardTitle>
          
          <div className="flex items-center gap-2">
            {onRefresh && (
              <Button size="sm" variant="outline" onClick={onRefresh} disabled={loading}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            )}
            
            {onExport && (
              <Button size="sm" variant="outline" onClick={onExport}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-4">
          {/* Search */}
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search by employee or approver..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-8"
            />
          </div>

          {/* Stage Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                Stage: {stageFilter === 'all' ? 'All' : stageConfig[stageFilter as keyof typeof stageConfig]?.label}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setStageFilter('all')}>
                All Stages
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {Object.entries(stageConfig).map(([key, config]) => (
                <DropdownMenuItem key={key} onClick={() => setStageFilter(key)}>
                  <config.icon className="w-4 h-4 mr-2" />
                  {config.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Action Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                Action: {actionFilter === 'all' ? 'All' : actionConfig[actionFilter as keyof typeof actionConfig]?.label}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setActionFilter('all')}>
                All Actions
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {Object.entries(actionConfig).map(([key, config]) => (
                <DropdownMenuItem key={key} onClick={() => setActionFilter(key)}>
                  <config.icon className="w-4 h-4 mr-2" />
                  {config.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            <span>Loading approval history...</span>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>
              {entries.length === 0 
                ? 'No approval history available'
                : 'No entries match current filters'
              }
            </p>
            {searchQuery && (
              <Button
                variant="link"
                size="sm"
                onClick={() => setSearchQuery('')}
                className="mt-2"
              >
                Clear search
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredEntries.map((entry) => {
              const isExpanded = expandedEntries.has(entry.id);
              
              return (
                <div
                  key={entry.id}
                  className="border rounded-lg p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getStageBadge(entry.stage)}
                        {getActionBadge(entry.action)}
                        
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(entry.timestamp), 'MMM dd, yyyy HH:mm')}
                          <span className="mx-1">•</span>
                          {formatDistanceToNow(new Date(entry.timestamp))} ago
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="font-medium">
                          {employeeId ? 'Action performed' : entry.employee_name}
                        </div>
                        
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <User className="w-3 h-3" />
                          By {entry.performed_by}
                        </div>

                        {entry.notes && !isExpanded && (
                          <div className="text-sm text-muted-foreground line-clamp-2">
                            <MessageSquare className="w-3 h-3 inline mr-1" />
                            {entry.notes}
                          </div>
                        )}
                      </div>
                    </div>

                    {(entry.notes || entry.reason || entry.metadata) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleExpanded(entry.id)}
                        className="flex-shrink-0"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t space-y-3">
                      {entry.notes && (
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-2 text-sm font-medium mb-1">
                            <MessageSquare className="w-4 h-4" />
                            Notes
                          </div>
                          <p className="text-sm">{entry.notes}</p>
                        </div>
                      )}

                      {entry.reason && (
                        <div className="p-3 bg-red-50 rounded-lg">
                          <div className="flex items-center gap-2 text-sm font-medium mb-1 text-red-800">
                            <AlertTriangle className="w-4 h-4" />
                            Rejection Reason
                          </div>
                          <p className="text-sm text-red-700">{entry.reason}</p>
                        </div>
                      )}

                      {entry.metadata && (
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          {entry.metadata.previous_stage && (
                            <div>
                              <span className="font-medium">Previous Stage:</span>
                              <div className="mt-1">
                                {getStageBadge(entry.metadata.previous_stage)}
                              </div>
                            </div>
                          )}
                          
                          {entry.metadata.documents_count && (
                            <div>
                              <span className="font-medium">Documents:</span>
                              <p className="mt-1">{entry.metadata.documents_count} processed</p>
                            </div>
                          )}
                          
                          {entry.metadata.role_assigned && (
                            <div>
                              <span className="font-medium">Role Assigned:</span>
                              <p className="mt-1">{entry.metadata.role_assigned}</p>
                            </div>
                          )}
                          
                          {entry.metadata.priority && (
                            <div>
                              <span className="font-medium">Priority:</span>
                              <Badge 
                                className={`mt-1 capitalize ${
                                  entry.metadata.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                                  entry.metadata.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                                  'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {entry.metadata.priority}
                              </Badge>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Summary Statistics */}
        {filteredEntries.length > 0 && (
          <div className="mt-6 pt-4 border-t">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {Object.entries(actionConfig).map(([action, config]) => {
                const count = filteredEntries.filter(e => e.action === action).length;
                if (count === 0) return null;
                
                return (
                  <div key={action} className="text-center">
                    <div className="font-medium text-lg">{count}</div>
                    <div className="text-muted-foreground flex items-center justify-center gap-1">
                      <config.icon className="w-3 h-3" />
                      {config.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ApprovalHistory;