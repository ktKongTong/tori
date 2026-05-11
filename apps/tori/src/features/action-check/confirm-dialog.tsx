import type { actionCheckResponseSchema } from "@/api/modules/platform/shared/action-check";
import type React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/components/alert-dialog";
import type { z } from "zod";

type ActionCheckResponse = z.infer<typeof actionCheckResponseSchema>;

export function ActionImpactDialog({
  impact,
  open,
  onOpenChange,
  onConfirm,
}: {
  impact: ActionCheckResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <ConfirmDialog
      title={impact ? titleForImpact(impact) : "Confirm action"}
      description={impact?.summary ?? "Review the affected resources before continuing."}
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
    >
      {impact ? <ImpactList impact={impact} /> : null}
    </ConfirmDialog>
  );
}

export function ConfirmDialog({
  title,
  description,
  children,
  open,
  onOpenChange,
  onConfirm,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            Continue
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ImpactList({ impact }: { impact: ActionCheckResponse }) {
  const items = [
    ...impact.blocking.map((item) => formatImpactItem("Blocked", item)),
    ...impact.affected.map((item) => formatImpactItem("Affected", item)),
    ...impact.asyncEffects.map((item) => formatImpactItem("Async", item)),
    ...impact.internalCleanup.map((item) => formatImpactItem("Cleanup", item)),
    ...impact.retained.map((item) => formatImpactItem("Retained", item)),
    ...impact.runtimeEffects.map((effect) => `Runtime: ${effect}`),
    ...impact.warnings.map((warning) => `Warning: ${warning}`),
  ].filter((item): item is string => Boolean(item));

  if (!items.length) return null;

  return (
    <div className="flex max-h-64 flex-col gap-2 overflow-auto text-sm text-muted-foreground">
      {items.map((item) => (
        <p key={item}>{item}</p>
      ))}
    </div>
  );
}

function titleForImpact(impact: ActionCheckResponse) {
  const label = impact.resource.label ?? impact.resource.id;
  if (impact.action === "delete") return `Delete ${label}`;
  if (impact.action === "disable") return `Disable ${label}`;
  if (impact.action === "revoke") return `Revoke ${label}`;
  return `Confirm ${label}`;
}

function formatImpactItem(prefix: string, item: unknown) {
  if (!item || typeof item !== "object") return null;
  const value = item as { type?: unknown; count?: unknown; action?: unknown; reason?: unknown };
  const type = typeof value.type === "string" ? value.type : "resource";
  const count = typeof value.count === "number" ? ` (${value.count})` : "";
  const action = typeof value.action === "string" ? ` ${value.action}` : "";
  const reason = typeof value.reason === "string" ? `: ${value.reason}` : "";
  return `${prefix}: ${type}${count}${action}${reason}`;
}
