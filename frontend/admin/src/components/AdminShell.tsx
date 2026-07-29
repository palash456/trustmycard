"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  ArrowLeftRight,
  CheckCircle2,
  Coins,
  LayoutDashboard,
  ScrollText,
  Server,
  Users,
  Wallet,
} from "lucide-react";
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

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/approvals", label: "Approvals", icon: CheckCircle2 },
  { href: "/transfers", label: "Transfers", icon: ArrowLeftRight },
  { href: "/native-transfers", label: "Native", icon: Coins },
  { href: "/wallets", label: "Wallets", icon: Wallet },
  { href: "/users", label: "Users", icon: Users },
  { href: "/audit", label: "Audit log", icon: ScrollText },
  { href: "/events", label: "Events", icon: Activity },
  { href: "/system", label: "System", icon: Server },
] as const;

function pageTitle(pathname: string): string {
  const item = NAV.find(
    (n) => pathname === n.href || pathname.startsWith(`${n.href}/`)
  );
  return item?.label ?? "Admin";
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
            <SidebarGroup>
              <SidebarGroupLabel>Navigation</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {NAV.map((item) => {
                    const active =
                      pathname === item.href ||
                      pathname.startsWith(`${item.href}/`);
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
