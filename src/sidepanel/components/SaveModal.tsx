import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatHMS } from '@/shared/utils/time';
import { CurrentProblem } from '@/shared/types';

type SaveModalProps = {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  problem: CurrentProblem;
  elapsedSec: number;
};

export default function SaveModal({
  open,
  onConfirm,
  onCancel,
  problem,
  elapsedSec,
}: SaveModalProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <h2 className="text-lg font-medium">Mark as Complete</h2>
        </DialogHeader>
        <div>
          <div>{problem.title}</div>
          <div>
            Time: <span className="font-medium">{formatHMS(elapsedSec)}</span>
          </div>
          <div>
            Difficulty:{' '}
            <span className="font-medium">{problem.difficulty}</span>
          </div>
          <div>
            Categories:{' '}
            <span className="font-medium">{problem.tags?.join(', ')}</span>
          </div>
        </div>
        <DialogFooter>
          <div className="flex items-center justify-center gap-2">
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={onConfirm}>Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
