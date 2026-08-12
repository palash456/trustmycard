"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  BookOpen,
  ClipboardList,
  FlaskConical,
  GitBranch,
  LayoutDashboard,
  Lock,
  Receipt,
  ScrollText,
  Server,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useDeveloperMode } from "@/components/DeveloperModeProvider";
import { HeaderControls } from "@/components/HeaderControls";
import { BrandWordmark } from "@/components/BrandWordmark";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/pipeline", label: "Pipeline", icon: GitBranch },
      { href: "/users", label: "Users", icon: Users },
    ],
  },
  {
    title: "Monitoring",
    items: [
      { href: "/transactions", label: "Transactions", icon: Receipt },
      { href: "/activity", label: "Activity", icon: Activity },
      { href: "/audit", label: "Audit & logs", icon: ScrollText },
    ],
  },
  {
    title: "Administration",
    items: [
      { href: "/system", label: "System", icon: Server },
      { href: "/admin-actions", label: "Admin actions", icon: ClipboardList },
      { href: "/documentation", label: "Documentation", icon: BookOpen },
      { href: "/developer-test", label: "Developer Test", icon: FlaskConical },
    ],
  },
];

const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap((section) => section.items);

function pageTitle(pathname: string): string {
  const item = ALL_NAV_ITEMS.find(
    (n) => pathname === n.href || pathname.startsWith(`${n.href}/`),
  );
  if (item) return item.label;

  // Detail routes under merged sections
  if (
    pathname.startsWith("/approvals") ||
    pathname.startsWith("/transfers") ||
    pathname.startsWith("/native-transfers")
  ) {
    return "Pipeline";
  }
  if (pathname.startsWith("/settlement-sessions")) return "Transactions";
  if (pathname.startsWith("/events")) return "Activity";
  if (pathname.startsWith("/transactions")) return "Transactions";
  if (pathname.startsWith("/wallets")) return "Users";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/documentation")) return "Documentation";

  return "Admin";
}

function isNavActive(pathname: string, href: string): boolean {
  if (pathname === href || pathname.startsWith(`${href}/`)) return true;

  // Pipeline absorbs legacy operational list/detail routes
  if (href === "/pipeline") {
    return (
      pathname.startsWith("/approvals") ||
      pathname.startsWith("/transfers") ||
      pathname.startsWith("/native-transfers")
    );
  }

  // Users absorbs wallet routes
  if (href === "/users") {
    return pathname.startsWith("/wallets");
  }

  // Activity absorbs legacy events routes
  if (href === "/activity") {
    return pathname.startsWith("/events");
  }

  // Transactions absorbs settlement session detail routes
  if (href === "/transactions") {
    return pathname.startsWith("/settlement-sessions");
  }

  if (href === "/documentation") {
    return pathname.startsWith("/documentation");
  }

  return false;
}

function SidebarBrand() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <div
      className={cn(
        "flex h-full w-full items-center",
        collapsed ? "justify-center px-1" : "px-2",
      )}
    >
      <Link
        href="/dashboard"
        className="flex items-center rounded-md px-1 outline-none ring-sidebar-ring focus-visible:ring-2"
      >
        <BrandWordmark size="sm" collapsed={collapsed} />
      </Link>
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { tryNavigate, isProtectedRoute } = useDeveloperMode();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <TooltipProvider>
      <SidebarProvider>
        <Sidebar
          collapsible="icon"
          variant="inset"
          className="border-sidebar-border/80"
        >
          <SidebarHeader className="h-14 shrink-0 flex-row items-center gap-0 border-b border-sidebar-border/70 p-0">
            <SidebarBrand />
          </SidebarHeader>

          <SidebarContent className="gap-1 px-1">
            {NAV_SECTIONS.map((section) => (
              <SidebarGroup key={section.title}>
                <SidebarGroupLabel className="px-3 text-[10px] font-semibold tracking-[0.14em] uppercase text-sidebar-foreground/45">
                  {section.title}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {section.items.map((item) => {
                      const active = isNavActive(pathname, item.href);
                      const Icon = item.icon;
                      const locked = isProtectedRoute(item.href);
                      return (
                        <SidebarMenuItem key={item.href}>
                          {locked ? (
                            <SidebarMenuButton
                              isActive={active}
                              tooltip={`${item.label} (locked)`}
                              className="rounded-lg transition-colors duration-150"
                              onClick={() => tryNavigate(item.href)}
                            >
                              <Icon />
                              <span className="flex-1">{item.label}</span>
                              <Lock className="size-3 shrink-0 opacity-50" />
                            </SidebarMenuButton>
                          ) : (
                            <SidebarMenuButton
                              isActive={active}
                              tooltip={item.label}
                              className="rounded-lg transition-colors duration-150"
                              render={<Link href={item.href} />}
                            >
                              <Icon />
                              <span>{item.label}</span>
                            </SidebarMenuButton>
                          )}
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>

          <SidebarRail />
        </Sidebar>

        <SidebarInset className="app-canvas min-w-0 overflow-x-hidden md:shadow-[var(--surface-shadow-lg)]">
          <header className="glass-header flex h-14 shrink-0 items-center gap-4 px-4 md:px-6">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="hidden h-5 sm:block" />
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <p className="font-brand truncate text-[15px] font-semibold tracking-tight text-foreground">
                {pageTitle(pathname)}
              </p>
            </div>
            <HeaderControls onLogout={() => void logout()} />
          </header>
          <div className="flex min-w-0 flex-1 flex-col gap-5 overflow-x-hidden p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
