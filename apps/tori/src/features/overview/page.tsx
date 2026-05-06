import { Button } from "@repo/ui/components/button";
import { Link } from "@tanstack/react-router";
import { DashboardMetric, DashboardNotice, DashboardPanel } from "@/components/dashboard-ui";
import { useDashboardBindingQuery } from "@/features/binding/query";
import { useDashboardIntegrationQuery } from "@/features/integration/query";
import {
  useDashboardNotifyEventsQuery,
  useDashboardNotifySubscriptionsQuery,
} from "@/features/notify/query";

export function DashboardOverviewPage() {
  const bindingQuery = useDashboardBindingQuery();
  const integrationQuery = useDashboardIntegrationQuery();
  const notifySubscriptionsQuery = useDashboardNotifySubscriptionsQuery();
  const notifyEventsQuery = useDashboardNotifyEventsQuery();
  const binding = bindingQuery.data;
  const integration = integrationQuery.data;
  const notifySubscriptions = notifySubscriptionsQuery.data;
  const notifyEvents = notifyEventsQuery.data;

  const activeUserBindings = binding?.userBindings.length ?? 0;
  const activeConnections =
    integration?.connections.filter((item) => item.status === "active").length ?? 0;
  const activeSubscriptions =
    notifySubscriptions?.subscriptions.filter((item) => item.status === "active").length ?? 0;
  const failedNotifications =
    notifyEvents?.notificationEvents.filter((item) => item.status === "failed").length ?? 0;
  const latestSubscription = notifySubscriptions?.subscriptions[0] ?? null;
  const latestEvent = notifyEvents?.notificationEvents[0] ?? null;
  const latestConnection = integration?.connections[0] ?? null;
  const latestBinding = binding?.userBindings[0] ?? null;

  const nextStep =
    activeUserBindings === 0
      ? {
          title: "Start in Playground",
          detail:
            "Start from the playground so the bot can create a named trial identity and begin the binding flow.",
          to: "/playground",
          label: "Open Playground",
        }
      : activeConnections === 0
        ? {
            title: "Add a connection",
            detail:
              "Create or verify a readable provider connection before testing account and family workflows.",
            to: "/integration",
            label: "Open My Connections",
          }
        : activeSubscriptions === 0
          ? {
              title: "Create your first subscription",
              detail:
                "Once identity and connection are ready, subscribe a channel so notification flow can be verified end to end.",
              to: "/notify",
              label: "Open My Subscriptions",
            }
          : {
              title: "Continue in Playground",
              detail:
                "Your workspace has the minimum setup to try commands and verify the live notification path.",
              to: "/playground",
              label: "Open Playground",
            };

  const watchouts = [
    activeUserBindings === 0 ? "No active user binding yet." : null,
    activeConnections === 0 ? "No active provider connection yet." : null,
    activeSubscriptions === 0 ? "No active subscription yet." : null,
    failedNotifications > 0
      ? `${failedNotifications} notification event${failedNotifications > 1 ? "s" : ""} failed recently.`
      : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <DashboardMetric
          label="Identity"
          value={activeUserBindings > 0 ? "Ready" : "Needs setup"}
          detail={
            activeUserBindings > 0
              ? `${activeUserBindings} active user binding${activeUserBindings > 1 ? "s" : ""}.`
              : "No active user binding yet."
          }
        />
        <DashboardMetric
          label="Connections"
          value={activeConnections > 0 ? "Ready" : "Needs setup"}
          detail={
            activeConnections > 0
              ? `${activeConnections} active provider connection${activeConnections > 1 ? "s" : ""}.`
              : "No active provider connection yet."
          }
        />
        <DashboardMetric
          label="Subscriptions"
          value={activeSubscriptions > 0 ? String(activeSubscriptions) : "0"}
          detail={
            failedNotifications > 0
              ? `${failedNotifications} notification event${failedNotifications > 1 ? "s" : ""} currently failed.`
              : "No notification failures detected in the latest event history."
          }
        />
      </div>

      <DashboardPanel eyebrow="Next Step" title={nextStep.title} description={nextStep.detail}>
        <div className="flex flex-wrap gap-3">
          <Button render={<Link to={nextStep.to} />}>{nextStep.label}</Button>
          <Button render={<Link to="/playground" />} variant="outline">
            Open Playground
          </Button>
        </div>
      </DashboardPanel>

      <DashboardPanel
        eyebrow="Recent Activity"
        title="Latest Workspace Activity"
        description="A compact summary of the latest identity, connection, subscription, and event state in your workspace."
      >
        <div className="grid gap-3 lg:grid-cols-2">
          {[
            {
              label: "Latest binding",
              detail: latestBinding
                ? `${latestBinding.userName} is bound on ${latestBinding.platform} as ${latestBinding.externalUserName}.`
                : "No user binding has been created yet.",
              to: "/binding",
            },
            {
              label: "Latest connection",
              detail: latestConnection
                ? `${latestConnection.accountLabel} is available through ${latestConnection.provider}.`
                : "No provider connection has been added yet.",
              to: "/integration",
            },
            {
              label: "Latest subscription",
              detail: latestSubscription
                ? `${latestSubscription.channelLabel} is subscribed to ${latestSubscription.topicType}.`
                : "No subscription has been created yet.",
              to: "/notify",
            },
            {
              label: "Latest notification event",
              detail: latestEvent
                ? `${latestEvent.subscriptionLabel ?? "Notification"} was last recorded for ${latestEvent.channelLabel} at ${latestEvent.createdAt}.`
                : "No notification event has been recorded yet.",
              to: "/notify/events",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="flex flex-col gap-3 border bg-muted/20 px-4 py-4 text-sm text-foreground"
            >
              <div>
                <p className="font-medium text-foreground">{item.label}</p>
                <p className="mt-2 text-muted-foreground">{item.detail}</p>
              </div>
              <div>
                <Button render={<Link to={item.to} />} variant="outline" size="xs">
                  Open
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DashboardPanel>

      <DashboardPanel
        eyebrow="Watchouts"
        title="What Needs Attention"
        description="These are the gaps most likely to block a successful bot trial."
      >
        <div className="grid gap-3 lg:grid-cols-2">
          {watchouts.length ? (
            watchouts.map((item) => <DashboardNotice key={item}>{item}</DashboardNotice>)
          ) : (
            <DashboardNotice>
              Your workspace has the minimum setup required for a complete trial flow.
            </DashboardNotice>
          )}
        </div>
      </DashboardPanel>
    </div>
  );
}
