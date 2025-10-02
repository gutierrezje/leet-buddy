import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type SaveModalProps = {
    open: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function SaveModal({ open, onConfirm, onCancel }: SaveModalProps) {
    return (
        <Dialog
            open={open}
            onOpenChange={o => !o && onCancel()}>
            <DialogContent>
                <DialogHeader>
                    <h2 className="text-lg font-medium">Save Progress</h2>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button onClick={onConfirm}>Save</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}