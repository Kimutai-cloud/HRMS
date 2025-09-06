import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { 
  FileText, 
  Download, 
  Eye, 
  CheckCircle, 
  X, 
  AlertTriangle,
  Calendar,
  User,
  FileType,
  HardDrive,
  ExternalLink,
  MessageSquare,
  History,
  Loader2
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';

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

interface DocumentPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  document: DocumentData | null;
  onApprove?: (documentId: string, notes: string) => void;
  onReject?: (documentId: string, reason: string) => void;
  onDownload?: (documentId: string) => void;
  loading?: boolean;
}

const DocumentPreview: React.FC<DocumentPreviewProps> = ({
  isOpen,
  onClose,
  document,
  onApprove,
  onReject,
  onDownload,
  loading = false,
}) => {
  const [notes, setNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionForm, setShowRejectionForm] = useState(false);

  const handleApprove = () => {
    if (document && onApprove) {
      onApprove(document.id, notes);
      setNotes('');
    }
  };

  const handleReject = () => {
    if (document && onReject && rejectionReason.trim()) {
      onReject(document.id, rejectionReason);
      setRejectionReason('');
      setShowRejectionForm(false);
    }
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
    if (fileType.includes('pdf')) return <FileText className="w-5 h-5 text-red-500" />;
    if (fileType.includes('image')) return <FileType className="w-5 h-5 text-blue-500" />;
    if (fileType.includes('doc')) return <FileText className="w-5 h-5 text-blue-600" />;
    return <FileText className="w-5 h-5 text-gray-500" />;
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (!document) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {getFileTypeIcon(document.file_type)}
            Document Preview: {document.filename}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Document Information */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  Document Details
                  {getStatusBadge(document.status)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <FileType className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">Type:</span>
                    <span>{document.document_type}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">Size:</span>
                    <span>{formatFileSize(document.file_size)}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">Uploaded:</span>
                    <span>{format(new Date(document.upload_date), 'MMM dd, yyyy')}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">Format:</span>
                    <span className="uppercase">{document.file_type.split('/')[1]}</span>
                  </div>
                </div>

                {/* Approval/Rejection Info */}
                {document.status !== 'pending' && (
                  <div className="pt-4 border-t space-y-2">
                    {document.status === 'approved' && document.approval_date && (
                      <div className="flex items-start gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                        <div>
                          <p className="font-medium text-green-800">Approved</p>
                          <p className="text-muted-foreground">
                            {format(new Date(document.approval_date), 'MMM dd, yyyy')}
                            {document.approved_by && ` by ${document.approved_by}`}
                          </p>
                          {document.notes && (
                            <p className="text-sm mt-1 p-2 bg-green-50 rounded">{document.notes}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {document.status === 'rejected' && document.rejection_reason && (
                      <div className="flex items-start gap-2 text-sm">
                        <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
                        <div>
                          <p className="font-medium text-red-800">Rejected</p>
                          <p className="text-sm mt-1 p-2 bg-red-50 rounded">{document.rejection_reason}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onDownload?.(document.id)}
                    className="flex-1"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                  
                  {onDownload && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDownload(document.id)}
                      className="flex-1"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download & Preview
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Document Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                {document.file_type.includes('image') ? (
                  <div className="bg-muted rounded-lg p-4">
                    <img 
                      src={`${document.url}?token=${localStorage.getItem('accessToken')}`} 
                      alt={document.filename}
                      className="max-w-full h-auto rounded"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.parentElement?.querySelector('.fallback-message');
                        if (fallback) fallback.style.display = 'block';
                      }}
                    />
                    <div className="fallback-message text-center text-muted-foreground" style={{display: 'none'}}>
                      <FileText className="w-16 h-16 mx-auto mb-4" />
                      <p>Image preview unavailable</p>
                      <p className="text-sm mt-2">Click 'Download' to view file</p>
                    </div>
                  </div>
                ) : document.file_type.includes('pdf') ? (
                  <div className="bg-muted rounded-lg p-8 text-center">
                    <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">PDF Preview</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Click 'Open' to view full PDF in new tab
                    </p>
                  </div>
                ) : (
                  <div className="bg-muted rounded-lg p-8 text-center">
                    <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Preview not available</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Download file to view contents
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Review Actions */}
          {document.status === 'pending' && (onApprove || onReject) && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    Document Review
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!showRejectionForm ? (
                    <>
                      {/* Approval Section */}
                      <div className="space-y-3">
                        <label className="text-sm font-medium">Approval Notes (Optional)</label>
                        <Textarea
                          placeholder="Add notes about this document review..."
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          className="min-h-[100px]"
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={handleApprove}
                          disabled={loading}
                          className="flex-1 bg-green-600 hover:bg-green-700"
                        >
                          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                          Approve Document
                        </Button>
                        
                        <Button
                          variant="destructive"
                          onClick={() => setShowRejectionForm(true)}
                          disabled={loading}
                          className="flex-1"
                        >
                          <AlertTriangle className="w-4 h-4 mr-2" />
                          Reject
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Rejection Form */}
                      <div className="space-y-3">
                        <label className="text-sm font-medium text-red-700">Rejection Reason *</label>
                        <Textarea
                          placeholder="Explain why this document is being rejected..."
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
                          className="flex-1"
                        >
                          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <X className="w-4 h-4 mr-2" />}
                          Confirm Rejection
                        </Button>
                        
                        <Button
                          variant="outline"
                          onClick={() => setShowRejectionForm(false)}
                          disabled={loading}
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Review Guidelines */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <History className="w-5 h-5" />
                    Review Guidelines
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>✓ Verify document is legible and complete</p>
                    <p>✓ Check that document type matches requirements</p>
                    <p>✓ Ensure information is current and valid</p>
                    <p>✓ Look for any signs of tampering or forgery</p>
                    <p>✓ Confirm document belongs to the employee</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentPreview;