import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Library, TrendingUp, Settings, Users } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import Logo from "@/components/common/Logo";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/connections", label: "Connections", icon: Users },
  { to: "/library", label: "Library", icon: Library },
  { to: "/analytics", label: "Analytics", icon: TrendingUp },
  { to: "/settings", label: "Settings", icon: Settings },
];

function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-5">
        <Logo collapsed={collapsed} />
      </SidebarHeader>
      <SidebarContent className="px-3">
        <SidebarMenu className="gap-1 mt-4">
          {navItems.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to;
            return (
              <SidebarMenuItem key={to}>
                <NavLink to={to} className="w-full">
                  <Button
                    variant={active ? "secondary" : "ghost"}
                    className={`w-full h-11 text-base gap-3 px-3 ${collapsed ? "justify-center" : "justify-start"}`}
                  >
                    <Icon className="size-5 shrink-0" />
                    {!collapsed && <span>{label}</span>}
                  </Button>
                </NavLink>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}

export default AppSidebar;
