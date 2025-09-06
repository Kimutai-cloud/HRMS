import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  FileText, 
  Download, 
  Eye, 
  CheckCircle,
  AlertTriangle,
  X,
  Calendar,
  HardDrive,
  FileType,
  Upload,
  Clock,
  User,
  MessageSquare,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import DocumentPreview from '../DocumentPreview';

interface DocumentData {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  upload_date: string;
  status: 'pending' | 'approved' | 'rejected';
  document_type: string;
  notes?: string;
  approval_date?: string;
  approved_by?: string;
  rejection_reason?: string;
  url?: string;
}

interface EmployeeDocuments {
  id: string;
  first_name: string;
  last_name: string;
  documents: DocumentData[];
  documents_summary?: {
    total_documents: number;
    approved_documents: number;
    pending_documents: number;
    rejected_documents: number;
  };
}

interface DocumentsReviewPanelProps {
  employee: EmployeeDocuments;
  onApprove: (notes: string) => Promise<void>;
  onReject: (reason: string) => Promise<void>;
  onDocumentApprove: (documentId: string, notes: string) => Promise<void>;
  onDocumentReject: (documentId: string, reason: string) => Promise<void>;
  onDownload: (documentId: string) => Promise<void>;
  loading?: boolean;
  readOnly?: boolean;
  isProcessing?: boolean;
}

const DocumentsReviewPanel: React.FC<DocumentsReviewPanelProps> = ({
  employee,
  onApprove,
  onReject,
  onDocumentApprove,
  onDocumentReject,
  onDownload,
  loading = false,
  readOnly = false,
  isProcessing = false
}) => {
  const { toast } = useToast();
  const [notes, setNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [activeAction, setActiveAction] = useState<'approve' | 'reject' | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<DocumentData | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loadingDocuments, setLoadingDocuments] = useState<Record<string, boolean>>({});

  const handleApprove = async () => {
    try {
      await onApprove(notes);
      setNotes('');
      setActiveAction(null);
      toast({
        title: 'Documents Approved',
        description: 'All documents have been approved successfully.',
      });
    } catch (error) {
      toast({
        title: 'Approval Failed',
        description: error instanceof Error ? error.message : 'Failed to approve documents',
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
        title: 'Documents Rejected',
        description: 'Documents have been rejected.',
      });
    } catch (error) {
      toast({
        title: 'Rejection Failed',
        description: error instanceof Error ? error.message : 'Failed to reject documents',
        variant: 'destructive',
      });
    }
  };

  const handleDocumentPreview = (document: DocumentData) => {
    setSelectedDocument(document);
    setPreviewOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending Review</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getFileTypeIcon = (fileType: string) => {
    if (!fileType) return <FileText className="w-5 h-5 text-gray-500" />;
    if (fileType.includes('pdf')) return <FileText className="w-5 h-5 text-red-500" />;
    if (fileType.includes('image')) return <FileType className="w-5 h-5 text-blue-500" />;
    if (fileType.includes('doc')) return <FileText className="w-5 h-5 text-blue-600" />;
    return <FileText className="w-5 h-5 text-gray-500" />;
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (!bytes || bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const summary = employee.documents_summary || {
    total_documents: employee.documents.length,
    approved_documents: employee.documents.filter(d => d.status === 'approved').length,
    pending_documents: employee.documents.filter(d => d.status === 'pending').length,
    rejected_documents: employee.documents.filter(d => d.status === 'rejected').length,
  };



  return (
    <div className="space-y-6">
      {/* Header with Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-green-600" />
              Documents Review: {employee.first_name} {employee.last_name}
            </CardTitle>
            
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-sm">
                {summary.total_documents} Total Documents
              </Badge>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{summary.approved_documents}</div>
              <div className="text-sm text-muted-foreground">Approved</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{summary.pending_documents}</div>
              <div className="text-sm text-muted-foreground">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{summary.rejected_documents}</div>
              <div className="text-sm text-muted-foreground">Rejected</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {summary.total_documents > 0 ? Math.round((summary.approved_documents / summary.total_documents) * 100) : 0}%
              </div>
              <div className="text-sm text-muted-foreground">Complete</div>
            </div>
          </div>
        </CardContent>
      </Card>



      {/* Documents Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {employee.documents.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="p-12 text-center">
              <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Documents Uploaded</h3>
              <p className="text-muted-foreground">
                This employee has not uploaded any documents for review.
              </p>
            </CardContent>
          </Card>
        ) : (
          employee.documents.map((document) => (
            <Card key={document.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {getFileTypeIcon(document.file_type)}
                    <div>
                      <CardTitle className="text-lg">{document.document_type}</CardTitle>
                      <div className="text-sm text-muted-foreground">{document.filename}</div>
                    </div>
                  </div>
                  {getStatusBadge(document.status)}
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Document Metadata */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-muted-foreground" />
                    <span>{formatFileSize(document.file_size)}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span>{format(new Date(document.upload_date), 'MMM dd, yyyy')}</span>
                  </div>
                </div>

                {/* Status Details */}
                {document.status === 'approved' && document.approval_date && (
                  <div className="p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-green-800">
                      <CheckCircle className="w-4 h-4" />
                      <span>Approved {format(new Date(document.approval_date), 'MMM dd, yyyy')}</span>
                      {document.approved_by && <span>by {document.approved_by}</span>}
                    </div>
                    {document.notes && (
                      <div className="mt-2 text-sm text-green-700">{document.notes}</div>
                    )}
                  </div>
                )}

                {document.status === 'rejected' && document.rejection_reason && (
                  <div className="p-3 bg-red-50 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-red-800 mb-2">
                      <X className="w-4 h-4" />
                      <span>Rejected</span>
                    </div>
                    <div className="text-sm text-red-700">{document.rejection_reason}</div>
                  </div>
                )}

                {document.status === 'pending' && (
                  <div className="p-3 bg-yellow-50 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-yellow-800">
                      <Clock className="w-4 h-4" />
                      <span>Awaiting review</span>
                    </div>
                  </div>
                )}

                {/* Document Actions */}
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDocumentPreview(document)}
                    className="flex-1"
                    disabled={loadingDocuments[document.id]}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Preview
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onDownload(document.id)}
                    className="flex-1"
                    disabled={loadingDocuments[document.id]}
                  >
                    {loadingDocuments[document.id] ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    Download
                  </Button>
                </div>

                {/* Individual Document Actions for Pending Documents */}
                {document.status === 'pending' && !readOnly && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={async () => {
                        setLoadingDocuments(prev => ({ ...prev, [document.id]: true }));
                        try {
                          await onDocumentApprove(document.id, 'Individual document approved');
                        } finally {
                          setLoadingDocuments(prev => ({ ...prev, [document.id]: false }));
                        }
                      }}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      disabled={loadingDocuments[document.id]}
                    >
                      {loadingDocuments[document.id] ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4 mr-2" />
                      )}
                      Approve
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={async () => {
                        setLoadingDocuments(prev => ({ ...prev, [document.id]: true }));
                        try {
                          await onDocumentReject(document.id, 'Document rejected during review');
                        } finally {
                          setLoadingDocuments(prev => ({ ...prev, [document.id]: false }));
                        }
                      }}
                      className="flex-1"
                      disabled={loadingDocuments[document.id]}
                    >
                      {loadingDocuments[document.id] ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <X className="w-4 h-4 mr-2" />
                      )}
                      Reject
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Overall Review Actions */}
      {!readOnly && employee.documents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Overall Documents Review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!activeAction ? (
              <div className="flex gap-3">
                <Button
                  onClick={() => setActiveAction('approve')}
                  disabled={loading || summary.pending_documents > 0}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve All Documents
                </Button>
                
                <Button
                  variant="destructive"
                  onClick={() => setActiveAction('reject')}
                  disabled={loading || isProcessing}
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Reject Documents
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {activeAction === 'approve' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-2">Approval Notes (Optional)</label>
                      <Textarea
                        placeholder="Add any notes about this document approval..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="min-h-[80px]"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleApprove} disabled={loading || isProcessing} className="bg-green-600 hover:bg-green-700">
                        {(loading || isProcessing) ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                        Confirm Approval
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
                        placeholder="Explain why the documents are being rejected..."
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

            {/* Review Guidelines */}
            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Document Review Guidelines
              </h4>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>✓ Verify all required documents are uploaded and complete</p>
                <p>✓ Check document quality and legibility</p>
                <p>✓ Ensure documents are current and valid</p>
                <p>✓ Confirm information matches employee profile</p>
                <p>✓ Look for any signs of tampering or forgery</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Document Preview Modal */}
      <DocumentPreview
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        document={selectedDocument}
        onApprove={onDocumentApprove}
        onReject={onDocumentReject}
        onDownload={onDownload}
        loading={loading}
      />
    </div>
  );
};

export default DocumentsReviewPanel;