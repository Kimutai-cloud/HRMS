import { useState, useEffect } from "react";
import { 
  Activity,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Calendar,
  User,
  Settings,
  FileText,
  Shield,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ArrowLeft
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { useNavigate } from "react-router-dom";
import EmployeeService from "@/services/employeeService";
import adminService, { type AuditLogEntry as AdminAuditLogEntry, type AuditLogFilters } from "@/services/adminService";

// Use the adminService interfaces, but keep local interface for compatibility
interface LocalAuditLogEntry {
  id: string;
  timestamp: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  ip_address: string;
  user_agent: string;
  changes: Record<string, any>;
  success: boolean;
  error_message?: string;
}

export default function AuditLogs() {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const navigate = useNavigate();
  const [auditLogs, setAuditLogs] = useState<LocalAuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [filterEntityType, setFilterEntityType] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [selectedLog, setSelectedLog] = useState<LocalAuditLogEntry | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const itemsPerPage = 25;
  const employeeService = new EmployeeService();

  useEffect(() => {
    loadAuditLogs();
  }, [currentPage, filterAction, filterEntityType]);

  const loadAuditLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const offset = (currentPage - 1) * itemsPerPage;

      // Build filters for adminService
      const filters: AuditLogFilters = {
        limit: itemsPerPage,
        offset: offset
      };
      
      if (filterAction !== "all") {
        filters.action = filterAction;
      }
      if (filterEntityType !== "all") {
        filters.resource_type = filterEntityType; // Note: adminService uses resource_type
      }

      const response = await adminService.getAuditLogs(filters);
      
      // Ensure response has the expected structure
      if (!response || typeof response !== 'object') {
        throw new Error('Invalid response format from audit logs API');
      }
      
      // Convert adminService format to local format
      const convertedLogs: LocalAuditLogEntry[] = (Array.isArray(response.entries) ? response.entries : []).map((log: AdminAuditLogEntry) => ({
        id: log.id,
        timestamp: log.timestamp,
        user_id: log.user_id,
        action: log.action,
        entity_type: log.resource_type || log.entity_type, // Support both field names
        entity_id: log.resource_id || log.entity_id || '',
        ip_address: log.ip_address,
        user_agent: log.user_agent,
        changes: log.details || log.changes || {},
        success: log.severity ? (log.severity !== 'error' && log.severity !== 'critical') : true,
        error_message: log.severity === 'error' || log.severity === 'critical' ? 'Operation failed' : undefined
      }));
      
      setAuditLogs(convertedLogs);
      setTotalCount(response.total_count || 0);
      setHasMore(response.has_more || false);

    } catch (err) {
      console.error('Failed to load audit logs:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load audit logs';
      setError(errorMessage);
      showNotification('error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setCurrentPage(1);
    loadAuditLogs();
    showNotification('success', 'Audit logs refreshed');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadAuditLogs();
  };

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'login':
      case 'logout':
        return <Shield className="w-4 h-4 text-blue-500" />;
      case 'create':
      case 'profile_created':
        return <FileText className="w-4 h-4 text-green-500" />;
      case 'update':
      case 'profile_updated':
        return <Settings className="w-4 h-4 text-yellow-500" />;
      case 'delete':
      case 'rejected':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'approved':
      case 'verified':
        return <User className="w-4 h-4 text-green-600" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (success: boolean, error?: string) => {
    if (success) {
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Success</Badge>;
    } else {
      return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Failed</Badge>;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getEntityTypeDisplay = (entityType: string) => {
    return entityType.replace('_', ' ').split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const handleViewDetails = (log: LocalAuditLogEntry) => {
    setSelectedLog(log);
    setIsDetailModalOpen(true);
  };

  const formatJsonValue = (value: any): string => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  const filteredLogs = auditLogs.filter(log => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      log.action.toLowerCase().includes(searchLower) ||
      log.entity_type.toLowerCase().includes(searchLower) ||
      log.user_id.toLowerCase().includes(searchLower) ||
      log.ip_address.toLowerCase().includes(searchLower)
    );
  });

  if (loading && auditLogs.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate(-1)}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Audit Logs</h1>
              <p className="text-muted-foreground">
                System activity and security audit trail
              </p>
            </div>
          </div>
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Filters and Search */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filters & Search
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <form onSubmit={handleSearch} className="flex-1 flex gap-2">
                <Input
                  placeholder="Search by action, user ID, IP address..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" size="sm">
                  <Search className="w-4 h-4" />
                </Button>
              </form>
              
              <div className="flex gap-2">
                <Select value={filterAction} onValueChange={setFilterAction}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter by action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    <SelectItem value="DETAILS_APPROVED">Details Approved</SelectItem>
                    <SelectItem value="DOCUMENTS_APPROVED">Documents Approved</SelectItem>
                    <SelectItem value="ROLE_ASSIGNED">Role Assigned</SelectItem>
                    <SelectItem value="FINAL_APPROVED">Final Approved</SelectItem>
                    <SelectItem value="PROFILE_REJECTED">Profile Rejected</SelectItem>
                    <SelectItem value="DOCUMENT_APPROVED">Document Approved</SelectItem>
                    <SelectItem value="DOCUMENT_REJECTED">Document Rejected</SelectItem>
                    <SelectItem value="BULK_APPROVAL">Bulk Approval</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterEntityType} onValueChange={setFilterEntityType}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="employee_document">Document</SelectItem>
                    <SelectItem value="bulk_operation">Bulk Operation</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <Activity className="w-8 h-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{totalCount}</p>
                  <p className="text-sm text-muted-foreground">Total Events</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <Shield className="w-8 h-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">
                    {auditLogs.filter(log => log.success).length}
                  </p>
                  <p className="text-sm text-muted-foreground">Successful</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-8 h-8 text-red-500" />
                <div>
                  <p className="text-2xl font-bold">
                    {auditLogs.filter(log => !log.success).length}
                  </p>
                  <p className="text-sm text-muted-foreground">Failed</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Audit Log Entries */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Activity Log
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {filteredLogs.length === 0 ? (
              <div className="text-center p-8">
                <Activity className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No audit logs found</p>
              </div>
            ) : (
              (Array.isArray(filteredLogs) ? filteredLogs : []).map((log) => (
                <div key={log.id} className="flex items-start justify-between p-4 border rounded-lg">
                  <div className="flex items-start gap-3 flex-1">
                    {getActionIcon(log.action)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">{log.action.replace('_', ' ')}</p>
                        {getStatusBadge(log.success, log.error_message)}
                        <Badge variant="outline" className="text-xs">
                          {getEntityTypeDisplay(log.entity_type)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">
                        User: {log.user_id} • IP: {log.ip_address}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatTimestamp(log.timestamp)}
                      </p>
                      {log.error_message && (
                        <p className="text-xs text-red-600 mt-1">
                          Error: {log.error_message}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleViewDetails(log)}
                    >
                      <Eye className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))
            )}

            {/* Pagination */}
            {(totalCount > itemsPerPage || hasMore) && (
              <div className="flex justify-between items-center pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} entries
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1 || loading}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => p + 1)}
                    disabled={!hasMore || loading}
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Audit Log Details Modal */}
        <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Audit Log Details</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh]">
              {selectedLog && (
                <div className="space-y-6 p-1">
                  {/* Basic Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Basic Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Action</label>
                        <p className="text-sm font-mono">{selectedLog.action}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Status</label>
                        <p className="text-sm">{getStatusBadge(selectedLog.success, selectedLog.error_message)}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Timestamp</label>
                        <p className="text-sm font-mono">{formatTimestamp(selectedLog.timestamp)}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Entity Type</label>
                        <p className="text-sm">{getEntityTypeDisplay(selectedLog.entity_type)}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Entity ID</label>
                        <p className="text-sm font-mono">{selectedLog.entity_id}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">User ID</label>
                        <p className="text-sm font-mono">{selectedLog.user_id}</p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Network Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Network Information</h3>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">IP Address</label>
                        <p className="text-sm font-mono">{selectedLog.ip_address || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">User Agent</label>
                        <p className="text-sm font-mono text-wrap break-all">{selectedLog.user_agent || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Changes and Details */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Changes & Details</h3>
                    <div className="bg-muted/30 p-4 rounded-lg">
                      <pre className="text-xs font-mono whitespace-pre-wrap overflow-auto max-h-60">
                        {formatJsonValue(selectedLog.changes)}
                      </pre>
                    </div>
                  </div>

                  {/* Error Information (if any) */}
                  {selectedLog.error_message && (
                    <>
                      <Separator />
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-destructive">Error Information</h3>
                        <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-lg">
                          <p className="text-sm text-destructive">{selectedLog.error_message}</p>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Log ID for reference */}
                  <Separator />
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Log ID</label>
                    <p className="text-xs font-mono text-muted-foreground">{selectedLog.id}</p>
                  </div>
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
  );
}