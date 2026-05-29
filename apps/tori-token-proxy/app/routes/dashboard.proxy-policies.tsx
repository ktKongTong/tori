import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import {
  DashboardActionBar,
  DashboardField,
  DashboardNotice,
  DashboardPanel,
  DashboardTable,
} from "~/components/dashboard-ui";
import {
  apiRequest,
  proxyPoliciesListSchema,
  proxyPolicySchema,
  type TokenProxyWebError,
} from "~/lib/api";

export const Route = createFileRoute("/dashboard/proxy-policies")({
  component: DashboardProxyPoliciesPage,
});

const METHOD_OPTIONS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

type HostMatch = "exact" | "suffix";
type PathMatch = "exact" | "prefix" | "glob";

interface RuleDraft {
  draftId: string;
  id: string;
  name: string;
  methods: string[];
  hostMatch: HostMatch;
  hostValue: string;
  pathMatch: PathMatch;
  pathValue: string;
}

function createDefaultRule(): RuleDraft {
  return {
    draftId: `draft-${Date.now()}`,
    id: "steam-webapi-user",
    name: "Steam WebAPI user endpoints",
    methods: ["GET"],
    hostMatch: "exact",
    hostValue: "api.steampowered.com",
    pathMatch: "prefix",
    pathValue: "/ISteamUser/",
  };
}

function createEmptyRule(index: number): RuleDraft {
  return {
    draftId: `draft-${Date.now()}-${index}`,
    id: `rule-${index + 1}`,
    name: `Allow rule ${index + 1}`,
    methods: ["GET"],
    hostMatch: "exact",
    hostValue: "",
    pathMatch: "prefix",
    pathValue: "/",
  };
}

function formatDate(epochSeconds: number | null | undefined) {
  if (!epochSeconds) return "—";
  return new Date(epochSeconds * 1000).toLocaleString();
}

function DashboardProxyPoliciesPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("Steam WebAPI Allowlist");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState<RuleDraft[]>(() => [createDefaultRule()]);
  const [formError, setFormError] = useState<string | null>(null);

  const policiesQuery = useQuery({
    queryKey: ["token-proxy", "proxy-policies"],
    queryFn: () =>
      apiRequest("/admin/proxy/policies").then((payload) => proxyPoliciesListSchema.parse(payload)),
  });

  const createPolicyMutation = useMutation({
    mutationFn: async () => {
      setFormError(null);
      const document = buildPolicyDocument(rules);
      const validationError = validatePolicyForm(name, rules);
      if (validationError) {
        setFormError(validationError);
        throw new Error(validationError);
      }

      return apiRequest("/admin/proxy/policies", {
        method: "POST",
        body: JSON.stringify({
          name,
          description: description || null,
          document,
        }),
      }).then((payload) => proxyPolicySchema.parse(payload));
    },
    onSuccess: () => {
      setCreateOpen(false);
      setName("Steam WebAPI Allowlist");
      setDescription("");
      setRules([createDefaultRule()]);
      void queryClient.invalidateQueries({ queryKey: ["token-proxy", "proxy-policies"] });
    },
  });

  const policies = policiesQuery.data?.items ?? [];
  const createError = createPolicyMutation.error as TokenProxyWebError | Error | null;
  const policyPreview = buildPolicyDocument(rules);

  return (
    <div className="space-y-4">
      <DashboardActionBar>
        <Button type="button" variant="outline" onClick={() => void policiesQuery.refetch()}>
          Refresh
        </Button>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          Create Proxy Policy
        </Button>
      </DashboardActionBar>

      {policiesQuery.isLoading ? (
        <DashboardNotice title="Loading">Fetching proxy policies.</DashboardNotice>
      ) : null}
      {policiesQuery.error instanceof Error ? (
        <DashboardNotice tone="error">{policiesQuery.error.message}</DashboardNotice>
      ) : null}

      <DashboardPanel
        eyebrow="Reusable allowlists"
        title="Proxy Policies"
        description="Reusable allowlist policies that OAuth clients bind to before they can proxy upstream requests."
      >
        <DashboardTable
          columns={["Created", "Name", "Policy ID", "Rules", "Description"]}
          rows={policies.map((policy) => [
            formatDate(policy.created_at),
            policy.name,
            <code key={`${policy.id}-id`} className="break-all text-xs">
              {policy.id}
            </code>,
            String(policy.document.rules.length),
            policy.description || "—",
          ])}
          rowIds={policies.map((policy) => policy.id)}
          empty="No proxy policies have been created yet."
        />
      </DashboardPanel>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="normal-case">Create Proxy Policy</DialogTitle>
            <DialogDescription>
              Build a reusable allowlist. A request is allowed when it matches any rule below.
            </DialogDescription>
          </DialogHeader>

          <div className="grid max-h-[72vh] gap-5 overflow-y-auto pr-1">
            <div className="grid gap-4 md:grid-cols-2">
              <DashboardField label="Policy name">
                <Input value={name} onChange={(event) => setName(event.target.value)} />
              </DashboardField>
              <DashboardField label="Description">
                <Input
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </DashboardField>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Allowed request rules</p>
                  <p className="text-xs leading-5 text-muted-foreground">
                    Rules are allow-only. No match means the proxy request is blocked and logged.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setRules((current) => [...current, createEmptyRule(current.length)])
                  }
                >
                  Add Rule
                </Button>
              </div>

              <div className="space-y-4">
                {rules.map((rule, index) => (
                  <RuleEditor
                    key={rule.draftId}
                    index={index}
                    rule={rule}
                    canRemove={rules.length > 1}
                    onChange={(nextRule) =>
                      setRules((current) =>
                        current.map((item) => (item.draftId === rule.draftId ? nextRule : item)),
                      )
                    }
                    onRemove={() =>
                      setRules((current) => current.filter((item) => item.draftId !== rule.draftId))
                    }
                  />
                ))}
              </div>
            </div>

            <DashboardField label="Generated policy preview">
              <pre className="max-h-48 overflow-auto border border-border/70 bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
                {JSON.stringify(policyPreview, null, 2)}
              </pre>
            </DashboardField>
          </div>

          {formError || createError ? (
            <DashboardNotice title="Policy creation failed" tone="error">
              {formError ?? createError?.message}
            </DashboardNotice>
          ) : null}

          <DashboardActionBar>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!name.trim() || rules.length === 0 || createPolicyMutation.isPending}
              onClick={() => createPolicyMutation.mutate()}
            >
              {createPolicyMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DashboardActionBar>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RuleEditor({
  index,
  rule,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number;
  rule: RuleDraft;
  canRemove: boolean;
  onChange: (rule: RuleDraft) => void;
  onRemove: () => void;
}) {
  return (
    <section className="border border-border/70 bg-card p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Rule {index + 1}</Badge>
          <span className="text-sm font-medium text-foreground">{rule.name || rule.id}</span>
        </div>
        {canRemove ? (
          <Button type="button" variant="outline" onClick={onRemove}>
            Remove
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <DashboardField label="Rule ID" hint="Stable identifier written to request logs.">
          <Input
            value={rule.id}
            onChange={(event) => onChange({ ...rule, id: event.target.value })}
          />
        </DashboardField>
        <DashboardField label="Rule name">
          <Input
            value={rule.name}
            onChange={(event) => onChange({ ...rule, name: event.target.value })}
          />
        </DashboardField>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[1.2fr_1fr_2fr_1fr_2fr]">
        <DashboardField label="Methods">
          <div className="flex flex-wrap gap-2">
            {METHOD_OPTIONS.map((method) => {
              const selected = rule.methods.includes(method);
              return (
                <Button
                  key={method}
                  type="button"
                  variant={selected ? "default" : "outline"}
                  size="sm"
                  onClick={() => onChange({ ...rule, methods: toggleMethod(rule.methods, method) })}
                >
                  {method}
                </Button>
              );
            })}
          </div>
        </DashboardField>

        <DashboardField label="Host match">
          <select
            className="h-10 border-0 border-b border-input bg-transparent text-sm outline-none focus:border-ring"
            value={rule.hostMatch}
            onChange={(event) => onChange({ ...rule, hostMatch: event.target.value as HostMatch })}
          >
            <option value="exact">Exact</option>
            <option value="suffix">Suffix</option>
          </select>
        </DashboardField>

        <DashboardField label="Host" hint="Example: api.steampowered.com">
          <Input
            value={rule.hostValue}
            onChange={(event) => onChange({ ...rule, hostValue: event.target.value })}
            placeholder="api.steampowered.com"
          />
        </DashboardField>

        <DashboardField label="Path match">
          <select
            className="h-10 border-0 border-b border-input bg-transparent text-sm outline-none focus:border-ring"
            value={rule.pathMatch}
            onChange={(event) => onChange({ ...rule, pathMatch: event.target.value as PathMatch })}
          >
            <option value="exact">Exact</option>
            <option value="prefix">Prefix</option>
            <option value="glob">Glob</option>
          </select>
        </DashboardField>

        <DashboardField label="Path" hint="Example: /ISteamUser/">
          <Input
            value={rule.pathValue}
            onChange={(event) => onChange({ ...rule, pathValue: event.target.value })}
            placeholder="/ISteamUser/"
          />
        </DashboardField>
      </div>
    </section>
  );
}

function toggleMethod(methods: string[], method: string) {
  return methods.includes(method)
    ? methods.filter((item) => item !== method)
    : [...methods, method];
}

function buildPolicyDocument(rules: RuleDraft[]) {
  return {
    mode: "allowlist",
    rules: rules.map((rule) => ({
      id: rule.id.trim(),
      name: rule.name.trim(),
      effect: "allow",
      methods: rule.methods,
      schemes: ["https"],
      hosts: [{ match: rule.hostMatch, value: rule.hostValue.trim() }],
      paths: [{ match: rule.pathMatch, value: rule.pathValue.trim() }],
    })),
  };
}

function validatePolicyForm(name: string, rules: RuleDraft[]) {
  if (!name.trim()) return "Policy name is required.";
  if (!rules.length) return "At least one allow rule is required.";

  const ids = new Set<string>();
  for (const [index, rule] of rules.entries()) {
    const label = `Rule ${index + 1}`;
    if (!rule.id.trim()) return `${label}: rule ID is required.`;
    if (ids.has(rule.id.trim())) return `${label}: rule ID must be unique.`;
    ids.add(rule.id.trim());
    if (!rule.name.trim()) return `${label}: rule name is required.`;
    if (!rule.methods.length) return `${label}: at least one method is required.`;
    if (!rule.hostValue.trim()) return `${label}: host is required.`;
    if (!rule.pathValue.trim().startsWith("/")) return `${label}: path must start with /.`;
  }

  return null;
}
