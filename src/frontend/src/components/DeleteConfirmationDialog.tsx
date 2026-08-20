import { Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";

/**
 * Shared delete-confirmation dialog used by GoalsPage (habit delete) and
 * MyGoalsPage (goal delete). The confirmation copy and body are passed in as
 * props so each page keeps its exact, distinct wording and behavior while
 * sharing the dialog frame, destructive styling, and the preventDefault
 * confirm flow that keeps the dialog open until the mutation settles.
 */
interface DeleteConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fired on confirm — the caller closes the dialog via its own onSettled. */
  onConfirm: () => void;
  isDeleting: boolean;
  /** Confirmation title copy, e.g. "Delete habit permanently?". */
  title: string;
  /** Body content — page-specific warning / affected-habit list. */
  description: ReactNode;
  /** data-ocid prefix, e.g. "my_habits.delete_dialog". */
  dataOcid: string;
}

export function DeleteConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  isDeleting,
  title,
  description,
  dataOcid,
}: DeleteConfirmationDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-ocid={dataOcid} className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-foreground flex items-center gap-2">
            <span
              className="inline-flex items-center justify-center w-8 h-8 rounded-full"
              style={{
                backgroundColor: "oklch(var(--destructive) / 0.12)",
                color: "oklch(var(--destructive))",
              }}
            >
              <Trash2 size={16} />
            </span>
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-muted-foreground text-sm leading-relaxed">
              {description}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            data-ocid={`${dataOcid}.cancel_button`}
            disabled={isDeleting}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            data-ocid={`${dataOcid}.confirm_button`}
            disabled={isDeleting}
            // Radix's AlertDialogAction auto-closes the dialog on click. That
            // close races (and can short-circuit) the onClick handler that
            // fires the delete mutation, so the mutation never reliably runs.
            // preventDefault() stops the auto-close; the mutation fires, the
            // dialog stays open while pending (showing the loading state), and
            // the caller's onSettled closes the dialog after the delete
            // settles — on success OR error — so a failed delete stays visible.
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-current/40 border-t-current rounded-full animate-spin" />
                Deleting…
              </span>
            ) : (
              "Delete permanently"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
