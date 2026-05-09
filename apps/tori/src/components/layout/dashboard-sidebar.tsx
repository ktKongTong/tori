import {
  IconBellRinging,
  IconChevronRight,
  IconClock,
  IconFingerprint,
  IconHome2,
  IconLayoutDashboard,
  IconLogout2,
  IconMessageCircleBolt,
  IconPlugConnected,
  IconRobot,
} from "@tabler/icons-react";
import { Link, useLocation } from "@tanstack/react-router";
import type { ComponentProps, ComponentType } from "react";

import { Button } from "@repo/ui/components/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarSeparator,
} from "@repo/ui/components/sidebar";

type DashboardSidebarProps = {
  isAdmin: boolean;
  sessionLabel: string;
  onSignOut: () => Promise<void> | void;
};

type NavItem = {
  to: string;
  label: string;
  exact?: boolean;
  icon: ComponentType<ComponentProps<"svg">>;
};

type NavTreeItem = NavItem & {
  children?: Array<{
    to: string;
    label: string;
    exact?: boolean;
    adminOnly?: boolean;
  }>;
  adminOnly?: boolean;
};

const WORKSPACE_ITEMS: NavTreeItem[] = [
  {
    to: "/",
    label: "Home",
    exact: true,
    icon: IconHome2,
  },
  {
    to: "/binding",
    label: "Identity & Bindings",
    icon: IconFingerprint,
    children: [
      {
        to: "/binding",
        label: "User Bindings",
        exact: true,
      },
      {
        to: "/binding/channels",
        label: "Channel Bindings",
      },
    ],
  },
  {
    to: "/integration",
    label: "Connections",
    icon: IconPlugConnected,
    children: [
      {
        to: "/integration",
        label: "My Connections",
        exact: true,
      },
      {
        to: "/integration/proxies",
        label: "Proxy Registry",
        adminOnly: true,
      },
    ],
  },
  {
    to: "/notify",
    label: "Subscriptions",
    icon: IconBellRinging,
    children: [
      {
        to: "/notify",
        label: "My Subscriptions",
        exact: true,
      },
    ],
  },
  {
    to: "/playground",
    label: "Playground",
    icon: IconMessageCircleBolt,
  },
];

const OPS_ITEMS: NavTreeItem[] = [
  {
    to: "/tasks",
    label: "Tasks",
    icon: IconClock,
  },
  {
    to: "/bot-instances",
    label: "Bot Runtime",
    icon: IconRobot,
  },
];

function isItemActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function SidebarNavSection({
  label,
  items,
  isAdmin,
}: {
  label: string;
  items: NavTreeItem[];
  isAdmin: boolean;
}) {
  const location = useLocation();

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const Icon = item.icon;
            const visibleChildren =
              item.children?.filter((child) => !child.adminOnly || isAdmin) ?? [];
            const hasChildren = visibleChildren.length > 0;

            return (
              <SidebarMenuItem key={item.to}>
                <SidebarMenuButton
                  render={<Link to={item.to} />}
                  isActive={isItemActive(location.pathname, item)}
                  tooltip={item.label}
                >
                  <Icon />
                  <span>{item.label}</span>
                </SidebarMenuButton>
                {hasChildren ? (
                  <SidebarMenuAction>
                    <IconChevronRight />
                  </SidebarMenuAction>
                ) : null}
                {hasChildren ? (
                  <SidebarMenuSub>
                    {visibleChildren.map((child) => (
                      <SidebarMenuSubItem key={child.to}>
                        <SidebarMenuSubButton
                          render={<Link to={child.to} />}
                          isActive={isItemActive(location.pathname, {
                            ...item,
                            to: child.to,
                            exact: child.exact,
                          })}
                        >
                          <span>{child.label}</span>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                ) : null}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function DashboardSidebar({ isAdmin, sessionLabel, onSignOut }: DashboardSidebarProps) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-0 p-1">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="Dashboard">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <IconLayoutDashboard className="size-4" />
              </div>
              <div className="flex flex-col gap-0.5 leading-none group-data-[collapsible=icon]:hidden">
                <span className="font-semibold">ToRi</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarSeparator className={"mx-0"} />
      <SidebarContent>
        <SidebarNavSection label="My Workspace" items={WORKSPACE_ITEMS} isAdmin={isAdmin} />
        {isAdmin ? (
          <>
            <SidebarSeparator />
            <SidebarNavSection label="Ops" items={OPS_ITEMS} isAdmin={isAdmin} />
          </>
        ) : null}
      </SidebarContent>

      <SidebarSeparator className={"mx-0"} />
      <SidebarFooter className="gap-2">
        <p className="truncate px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          {sessionLabel}
        </p>
        <Button
          variant="outline"
          onClick={() => void onSignOut()}
          className="w-full justify-center group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0"
        >
          <IconLogout2 data-icon="inline-start" />
          <span className="group-data-[collapsible=icon]:hidden">Sign out</span>
        </Button>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
