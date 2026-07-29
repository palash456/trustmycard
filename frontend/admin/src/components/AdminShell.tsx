"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  GitBranch,
  LayoutDashboard,
  ScrollText,
  Server,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
      { href: "/activity", label: "Activity", icon: Activity },
      { href: "/audit", label: "Audit log", icon: ScrollText },
    ],
  },
  {
    title: "Administration",
    items: [{ href: "/system", label: "System", icon: Server }],
  },
];

const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap((section) => section.items);

function pageTitle(pathname: string): string {
  const item = ALL_NAV_ITEMS.find(
    (n) => pathname === n.href || pathname.startsWith(`${n.href}/`)
  );
  if (item) return item.label;

  // Detail routes under merged sections
  if (pathname.startsWith("/approvals") || pathname.startsWith("/transfers") || pathname.startsWith("/native-transfers")) {
    return "Pipeline";
  }
  if (pathname.startsWith("/events")) return "Activity";
  if (pathname.startsWith("/wallets")) return "Users";
  if (pathname.startsWith("/settings")) return "Settings";

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

  return false;
}

function SidebarBrand() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <div className={cn("px-2 py-2", collapsed && "px-1")}>
      <Link
        href="/dashboard"
        className="flex items-center rounded-md px-1 py-1 outline-none ring-sidebar-ring focus-visible:ring-2"
      >
        <BrandWordmark size="md" collapsed={collapsed} />
      </Link>
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <TooltipProvider>
      <SidebarProvider>
        <Sidebar collapsible="icon" variant="inset">
          <SidebarHeader className="border-b border-sidebar-border pb-2">
            <SidebarBrand />
          </SidebarHeader>

          <SidebarContent>
            {NAV_SECTIONS.map((section) => (
              <SidebarGroup key={section.title}>
                <SidebarGroupLabel className="text-[10px] font-semibold tracking-widest uppercase text-sidebar-foreground/50">
                  {section.title}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {section.items.map((item) => {
                      const active = isNavActive(pathname, item.href);
                      const Icon = item.icon;
                      return (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton
                            isActive={active}
                            tooltip={item.label}
                            render={<Link href={item.href} />}
                          >
                            <Icon />
                            <span>{item.label}</span>
                          </SidebarMenuButton>
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

        <SidebarInset className="bg-background">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card/80 px-4 backdrop-blur-sm">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 hidden h-4! sm:block" />
            <div className="flex min-w-0 flex-1 items-center">
              <p className="truncate text-sm font-semibold tracking-tight text-foreground">
                {pageTitle(pathname)}
              </p>
            </div>
            <HeaderControls onLogout={() => void logout()} />
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
