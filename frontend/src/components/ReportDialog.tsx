import { useState, useCallback, memo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useReportPost } from '../hooks/useQueries';
import { toast } from 'sonner';

interface ReportDialogProps {
  postId: bigint;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ReportDialog({ postId, open, onOpenChange }: ReportDialogProps) {
  const [reason, setReason] = useState('');
  const reportPost = useReportPost();

  const handleSubmit = useCallback(async () => {
    if (!reason.trim()) {
      toast.error('Please provide a reason for reporting');
      return;
    }

    try {
      await reportPost.mutateAsync({ postId, reason: reason.trim() });
      toast.success('Post reported successfully');
      setReason('');
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to report post');
    }
  }, [reason, reportPost, postId, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dialog-animate">
        <DialogHeader>
          <DialogTitle>Report Post</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for reporting</Label>
            <Textarea
              id="reason"
              placeholder="Please describe why you're reporting this post..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="input-focus-animate"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={reportPost.isPending} className="button-hover-scale">
            {reportPost.isPending ? 'Reporting...' : 'Submit Report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default memo(ReportDialog);
