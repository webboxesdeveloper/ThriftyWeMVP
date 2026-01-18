import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';

interface FeedbackDialogProps {
  userId?: string;
}

export function FeedbackDialog({ userId }: FeedbackDialogProps) {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!feedback.trim()) {
      toast.error('Bitte geben Sie Ihr Feedback ein.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.submitFeedback(feedback, userId);
      toast.success('Vielen Dank für Ihr Feedback!');
      setFeedback('');
      setOpen(false);
    } catch (error: any) {
      toast.error(error?.message || 'Feedback konnte nicht gesendet werden. Bitte versuchen Sie es erneut.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Feedback
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Feedback senden</DialogTitle>
          <DialogDescription>
            Teilen Sie uns Ihre Meinung mit. Ihr Feedback hilft uns, die App zu verbessern.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            placeholder="Bitte beschreiben Sie Ihr Feedback, Ihre Ideen oder Probleme..."
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={6}
            className="resize-none"
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                setFeedback('');
              }}
              disabled={isSubmitting}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSubmitting || !feedback.trim()}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird gesendet...
                </>
              ) : (
                'Absenden'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

