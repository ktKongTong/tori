import { Link, useLocation } from "@tanstack/react-router";

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
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@repo/ui/components/sidebar";

type DashboardSidebarProps = {
  onSignOut: () => Promise<void> | void;
};

type NavItem = {
  to: string;
  label: string;
  exact?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    to: "/dashboard",
    label: "Overview",
    exact: true,
  },
  {
    to: "/dashboard/tokens",
    label: "Tokens",
  },
  {
    to: "/dashboard/logs",
    label: "Logs",
  },
  {
    to: "/dashboard/oauth-clients",
    label: "OAuth Clients",
  },
];

function isItemActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

export function DashboardSidebar({ onSignOut }: DashboardSidebarProps) {
  const location = useLocation();

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="gap-0 p-1">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="Token Proxy">
              <div className="flex aspect-square size-8 items-center justify-center bg-sidebar-primary text-[0.62rem] font-semibold tracking-[0.18em] text-sidebar-primary-foreground">
                TP
              </div>
              <div className="flex flex-col gap-0.5 leading-none group-data-[collapsible=icon]:hidden">
                <span className="font-semibold">Token Proxy</span>
                <span className="text-xs text-sidebar-foreground/65">Admin dashboard</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator className="mx-0" />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Control Plane</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    render={<Link to={item.to} />}
                    isActive={isItemActive(location.pathname, item)}
                    tooltip={item.label}
                  >
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator className="mx-0" />

      <SidebarFooter className="gap-0">
        <Button
          variant="outline"
          onClick={() => void onSignOut()}
          className="w-full justify-center group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0"
        >
          <span className="group-data-[collapsible=icon]:hidden">Sign out</span>
          <span className="hidden group-data-[collapsible=icon]:inline">SO</span>
        </Button>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
