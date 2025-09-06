/**
 * Task Comment System Component
 * Real-time commenting system with threading support
 */

import React, { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  useTaskComments, 
  useAddTaskComment, 
  useUpdateTaskComment, 
  useDeleteTaskComment 
} from '@/hooks/queries/useTaskQueries';
import { useTaskSubscription, useTaskCommentSender } from '@/hooks/useTaskWebSocket';
import { useAuth } from '@/contexts/AuthContext';
import type { TaskComment, AddCommentRequest } from '@/types/task';
import { CommentType } from '@/types/task';
import { 
  MessageSquare, 
  Reply, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  Send,
  AlertTriangle,
  Clock,
  CheckCircle
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const commentSchema = z.object({
  content: z.string()
    .min(1, 'Comment cannot be empty')
    .max(2000, 'Comment must be less than 2000 characters'),
  comment_type: z.nativeEnum(CommentType).optional(),
  parent_comment_id: z.string().optional()
});

type CommentFormData = z.infer<typeof commentSchema>;

interface TaskCommentSystemProps {
  taskId: string;
  className?: string;
}

interface CommentItemProps {
  comment: TaskComment;
  onReply: (parentId: string) => void;
  onEdit: (comment: TaskComment) => void;
  onDelete: (commentId: string) => void;
  level: number;
  currentUserId?: string;
}

const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  onReply,
  onEdit,
  onDelete,
  level,
  currentUserId
}) => {
  const isOwner = comment.author_id === currentUserId;
  const maxLevel = 3; // Limit nesting depth

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getCommentTypeInfo = (type: CommentType) => {
    switch (type) {
      case 'STATUS_CHANGE':
        return { icon: <CheckCircle className="w-3 h-3" />, label: 'Status Change', color: 'bg-blue-100 text-blue-800' };
      case 'PROGRESS_UPDATE':
        return { icon: <Clock className="w-3 h-3" />, label: 'Progress Update', color: 'bg-green-100 text-green-800' };
      case 'REVIEW_NOTES':
        return { icon: <MessageSquare className="w-3 h-3" />, label: 'Review Notes', color: 'bg-purple-100 text-purple-800' };
      default:
        return null;
    }
  };

  const typeInfo = getCommentTypeInfo(comment.comment_type);

  return (
    <div className={cn(
      'space-y-2',
      level > 0 && 'ml-6 pl-4 border-l-2 border-muted'
    )}>
      <div className="flex items-start gap-3">
        <Avatar className="w-8 h-8 flex-shrink-0">
          <AvatarFallback className="text-xs">
            {getInitials(comment.author_name)}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">{comment.author_name}</span>
            
            {typeInfo && (
              <Badge variant="outline" className={cn('text-xs', typeInfo.color)}>
                {typeInfo.icon}
                <span className="ml-1">{typeInfo.label}</span>
              </Badge>
            )}
            
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
            </span>
            
            {comment.is_edited && (
              <Badge variant="outline" className="text-xs">
                Edited
              </Badge>
            )}
          </div>
          
          <div className="prose prose-sm max-w-none">
            <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
          </div>
          
          <div className="flex items-center gap-2 mt-2">
            {level < maxLevel && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => onReply(comment.id)}
              >
                <Reply className="w-3 h-3 mr-1" />
                Reply
              </Button>
            )}
            
            {isOwner && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <MoreVertical className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => onEdit(comment)}>
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => onDelete(comment.id)}
                    className="text-red-600"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
      
      {/* Nested replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-2">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              level={level + 1}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const CommentForm: React.FC<{
  onSubmit: (data: CommentFormData) => void;
  onCancel?: () => void;
  initialData?: Partial<CommentFormData>;
  placeholder?: string;
  submitLabel?: string;
  isSubmitting?: boolean;
}> = ({ 
  onSubmit, 
  onCancel, 
  initialData, 
  placeholder = "Write a comment...", 
  submitLabel = "Comment",
  isSubmitting = false 
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch
  } = useForm<CommentFormData>({
    resolver: zodResolver(commentSchema),
    defaultValues: {
      content: initialData?.content || '',
      comment_type: initialData?.comment_type || CommentType.COMMENT,
      parent_comment_id: initialData?.parent_comment_id
    }
  });

  const content = watch('content');

  const onFormSubmit = (data: CommentFormData) => {
    onSubmit(data);
    if (!initialData) {
      reset();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [content]);

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-3">
      <div>
        <Textarea
          {...register('content')}
          ref={(e) => {
            register('content').ref(e);
            textareaRef.current = e;
          }}
          placeholder={placeholder}
          className={cn(
            'min-h-[80px] resize-none',
            errors.content && 'border-red-500'
          )}
          disabled={isSubmitting}
        />
        {errors.content && (
          <p className="text-sm text-red-500 mt-1">{errors.content.message}</p>
        )}
      </div>
      
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {content ? `${content.length}/2000 characters` : ''}
        </div>
        
        <div className="flex items-center gap-2">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            size="sm"
            disabled={!content?.trim() || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Clock className="w-4 h-4 mr-2 animate-spin" />
                Posting...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                {submitLabel}
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
};

export const TaskCommentSystem: React.FC<TaskCommentSystemProps> = ({
  taskId,
  className
}) => {
  const { user, userProfile } = useAuth();
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<TaskComment | null>(null);

  // Real-time subscription
  useTaskSubscription(taskId);
  const { sendComment } = useTaskCommentSender();

  // Queries and mutations
  const { data: comments, isLoading, error } = useTaskComments(taskId);
  const addCommentMutation = useAddTaskComment();
  const updateCommentMutation = useUpdateTaskComment();
  const deleteCommentMutation = useDeleteTaskComment();

  const handleAddComment = async (data: CommentFormData) => {
    try {
      const commentData = {
        comment_text: data.content,  // Backend expects 'comment_text', not 'content'
        comment_type: data.comment_type || 'COMMENT',
        parent_comment_id: data.parent_comment_id
      };

      await addCommentMutation.mutateAsync({ taskId, request: commentData });
      
      // Send real-time update
      sendComment(taskId, commentData);
      
      // Reset form state
      setReplyToId(null);
      
      toast.success('Comment added successfully');
    } catch (error: any) {
      toast.error('Failed to add comment', {
        description: error.message
      });
    }
  };

  const handleUpdateComment = async (data: CommentFormData) => {
    if (!editingComment) return;

    try {
      await updateCommentMutation.mutateAsync({
        taskId,
        commentId: editingComment.id,
        request: { comment_text: data.content }
      });
      
      setEditingComment(null);
      toast.success('Comment updated successfully');
    } catch (error: any) {
      toast.error('Failed to update comment', {
        description: error.message
      });
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      await deleteCommentMutation.mutateAsync({ taskId, commentId });
      toast.success('Comment deleted successfully');
    } catch (error: any) {
      toast.error('Failed to delete comment', {
        description: error.message
      });
    }
  };

  const handleReply = (parentId: string) => {
    setReplyToId(parentId);
    setEditingComment(null);
  };

  const handleEdit = (comment: TaskComment) => {
    setEditingComment(comment);
    setReplyToId(null);
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Comments
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="w-8 h-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-16 w-full" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="py-8">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to load comments. Please try again.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Organize comments with threading
  const organizedComments = comments?.filter(comment => !comment.parent_comment_id) || [];

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Comments
          {comments && comments.length > 0 && (
            <Badge variant="secondary">{comments.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Comment Form */}
        <div>
          {editingComment ? (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Edit2 className="w-4 h-4" />
                <span className="text-sm font-medium">Editing comment</span>
              </div>
              <CommentForm
                onSubmit={handleUpdateComment}
                onCancel={() => setEditingComment(null)}
                initialData={{
                  content: editingComment.content,
                  comment_type: editingComment.comment_type
                }}
                submitLabel="Update"
                isSubmitting={updateCommentMutation.isPending}
              />
            </div>
          ) : (
            <CommentForm
              onSubmit={handleAddComment}
              initialData={{
                parent_comment_id: replyToId || undefined
              }}
              placeholder={replyToId ? "Write a reply..." : "Write a comment..."}
              submitLabel={replyToId ? "Reply" : "Comment"}
              isSubmitting={addCommentMutation.isPending}
            />
          )}
          
          {replyToId && (
            <div className="mt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setReplyToId(null)}
              >
                Cancel Reply
              </Button>
            </div>
          )}
        </div>

        <Separator />

        {/* Comments List */}
        {organizedComments.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No comments yet</h3>
            <p className="text-muted-foreground">
              Be the first to leave a comment on this task.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {organizedComments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                onReply={handleReply}
                onEdit={handleEdit}
                onDelete={handleDeleteComment}
                level={0}
                currentUserId={userProfile?.employee?.id || user?.id}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TaskCommentSystem;