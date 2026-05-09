import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { FieldLabel as Label } from "@repo/ui/components/field";

import { useProxyInstancesQuery } from "@/features/integration/query";
import { createRequestClient } from "@repo/request";
import {
  connectionCreatedDtoSchema,
  type CreateConnectionDto,
} from "@/api/modules/platform/connection/contract";

const connectionRequest = createRequestClient({
  credentials: "include",
  headers: { accept: "application/json" },
});

type Step = "platform" | "proxy" | "input";

export function AddConnectionDialog({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("platform");
  const [platform, setPlatform] = useState<string>("");
  const [proxyId, setProxyId] = useState<string>("direct");
  const [providerAccountId, setProviderAccountId] = useState("");

  const { data: proxyData, isLoading: proxiesLoading } = useProxyInstancesQuery();

  const createConnection = useMutation({
    mutationFn: async (data: CreateConnectionDto) =>
      connectionRequest.post("/api/integration/connections", data, {
        schema: connectionCreatedDtoSchema,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["integration", "connections"] });
      toast.success("Connection created successfully");
      onOpenChange(false);
      reset();
    },
    onError: (error) => {
      toast.error("Failed to create connection", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    },
  });

  const reset = () => {
    setStep("platform");
    setPlatform("");
    setProxyId("direct");
    setProviderAccountId("");
  };

  const handleNext = () => {
    if (step === "platform") {
      setStep("proxy");
    } else if (step === "proxy") {
      if (proxyId === "direct") {
        setStep("input");
      } else {
        // Redirect to Proxy OAuth
        const proxy = proxyData?.items.find((p) => p.id === proxyId);
        if (proxy) {
          window.location.href = `${proxy.baseUrl}/admin/connections/connect?provider=${platform}&callback=${encodeURIComponent(window.location.origin + "/integration")}`;
        }
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createConnection.mutate({
      provider: platform,
      providerAccountId,
      accessMode: "public-id",
      proxyInstanceId: null,
      isDefault: false,
    });
  };

  // Derive unique platforms from proxies
  const availablePlatforms = Array.from(
    new Set(proxyData?.items.flatMap((p) => p.providers.map((pr) => pr.name)) ?? ["steam"]),
  );

  const filteredProxies = proxyData?.items.filter((p) =>
    p.providers.some((pr) => pr.name === platform),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        onOpenChange(val);
        if (!val) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Connection</DialogTitle>
          <DialogDescription>
            Connect an external account to receive notifications and execute commands.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {step === "platform" && (
            <div className="space-y-4">
              <Label>Select Platform</Label>
              <div className="grid grid-cols-2 gap-2">
                {availablePlatforms.map((p) => (
                  <Button
                    key={p}
                    variant={platform === p ? "default" : "outline"}
                    onClick={() => setPlatform(p)}
                    className="capitalize"
                  >
                    {p}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {step === "proxy" && (
            <div className="space-y-4">
              <Label>Select Connection Method</Label>
              <Select value={proxyId} onValueChange={(v) => setProxyId(v || "direct")}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a proxy or direct" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="direct">Direct (Public ID only)</SelectItem>
                  {filteredProxies?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      Proxy: {p.name ?? p.baseUrl}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {proxyId !== "direct" && (
                <p className="text-xs text-muted-foreground">
                  You will be redirected to the proxy for authorization.
                </p>
              )}
            </div>
          )}

          {step === "input" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="providerAccountId">
                  {platform === "steam" ? "Steam64 ID" : "Account ID"}
                </Label>
                <Input
                  id="providerAccountId"
                  value={providerAccountId}
                  onChange={(e) => setProviderAccountId(e.target.value)}
                  placeholder="e.g. 76561198000000000"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={createConnection.isPending}>
                {createConnection.isPending ? "Connecting..." : "Connect Account"}
              </Button>
            </form>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          {step !== "platform" ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep(step === "input" ? "proxy" : "platform")}
            >
              Back
            </Button>
          ) : (
            <div />
          )}
          {step !== "input" && (
            <Button type="button" onClick={handleNext} disabled={!platform}>
              Next
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
