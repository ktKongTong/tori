import { IconCopy } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@repo/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/sheet";

import {
  fetchIntegrationAccountProfile,
  refreshIntegrationFamily,
  type IntegrationConnectionListItem,
} from "@/features/integration/api";
import { useToastError } from "@/lib/toast-error";

export function ConnectionDetailSheet({
  item,
  onClose,
}: {
  item: IntegrationConnectionListItem;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const connection = item;

  const fetchProfile = useMutation({
    mutationFn: async (connectionId: string) => fetchIntegrationAccountProfile(connectionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["integration", "connections"] });
      toast.success("Profile fetched successfully");
    },
  });

  const refreshFamily = useMutation({
    mutationFn: async (connectionId: string) => refreshIntegrationFamily(connectionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["integration", "connections"] });
      toast.success("Family data refreshed");
    },
  });

  useToastError(fetchProfile.error, { title: "Failed to fetch account profile" });
  useToastError(refreshFamily.error, { title: "Failed to refresh family" });

  const displayName = connection.providerAccountName ?? connection.providerAccountId;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <Sheet
      open={true}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{displayName}</SheetTitle>
          <SheetDescription>{connection.provider} connection details and actions.</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 overflow-y-auto px-8 pb-8 pt-8">
          <div className="space-y-8">
            <div className="grid gap-3 border bg-muted/20 p-4 text-sm sm:grid-cols-2">
              <DetailItem label="Status" value={connection.status} />
              <DetailItem label="Access Mode" value={connection.accessMode} />
              <DetailItem
                label="Last Synced"
                value={
                  connection.lastSyncedAt
                    ? new Date(connection.lastSyncedAt).toLocaleString()
                    : "Never"
                }
              />
              {connection.proxy ? (
                <DetailItem
                  label="Attached Proxy"
                  value={`${connection.proxy.name} (${connection.proxy.status})`}
                />
              ) : null}
            </div>

            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-heading text-sm font-semibold tracking-[0.16em] uppercase">
                Actions
              </h3>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchProfile.mutate(connection.id)}
                  disabled={fetchProfile.isPending}
                >
                  {fetchProfile.isPending ? "Fetching..." : "Fetch Profile"}
                </Button>
                {connection.provider === "steam" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refreshFamily.mutate(connection.id)}
                    disabled={refreshFamily.isPending}
                  >
                    {refreshFamily.isPending ? "Refreshing..." : "Refresh Family"}
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-heading text-sm font-semibold tracking-[0.16em] uppercase">
                Diagnostic IDs
              </h3>
              <div className="space-y-3">
                <DiagnosticItem
                  label="Connection ID"
                  value={connection.id}
                  onCopy={() => copyToClipboard(connection.id)}
                />
                <DiagnosticItem
                  label="Provider Account ID"
                  value={connection.providerAccountId}
                  onCopy={() => copyToClipboard(connection.providerAccountId)}
                />
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 break-words text-foreground">{value}</p>
    </div>
  );
}

function DiagnosticItem({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border bg-muted/30 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
          {label}
        </p>
        <p className="truncate font-mono text-xs text-foreground mt-0.5">{value}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={onCopy}
        title="Copy to clipboard"
      >
        <span className="sr-only">Copy</span>
        <IconCopy className="size-3.5" />
      </Button>
    </div>
  );
}
