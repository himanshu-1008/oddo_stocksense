import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  Settings,
  Boxes,
  ArrowDownToLine,
  ArrowUpFromLine,
  Shuffle,
  SlidersHorizontal,
  History,
  Building2,
  ChevronDown,
  User,
  LogOut,
  AlertTriangle,
  Tags,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";

interface NavItemChild {
  title: string;
  href: string;
  icon: React.ElementType;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  children?: NavItemChild[];
}

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Products",
    href: "/products",
    icon: Package,
    children: [
      {
        title: "Products",
        href: "/products",
        icon: Package,
      },
      {
        title: "Categories",
        href: "/settings/categories",
        icon: Tags,
      },
      {
        title: "Low Stock Alerts",
        href: "/products/low-stock",
        icon: AlertTriangle,
      },
    ],
  },
  {
    title: "Operations",
    href: "/operations",
    icon: ArrowLeftRight,
    children: [
      {
        title: "Receipts",
        href: "/operations/receipts",
        icon: ArrowDownToLine,
      },
      {
        title: "Delivery Orders",
        href: "/operations/deliveries",
        icon: ArrowUpFromLine,
      },
      {
        title: "Internal Transfers",
        href: "/operations/transfers",
        icon: Shuffle,
      },
      {
        title: "Inventory Adjustments",
        href: "/operations/adjustments",
        icon: SlidersHorizontal,
      },
      {
        title: "Move History",
        href: "/operations/move-history",
        icon: History,
      },
    ],
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
    children: [
      {
        title: "Warehouse",
        href: "/settings/warehouses",
        icon: Building2,
      },
    ],
  },
  {
    title: "Profile",
    href: "/profile",
    icon: User,
    children: [
      {
        title: "My Profile",
        href: "/profile",
        icon: User,
      },
    ],
  },
];

interface SidebarProps {
  onClose?: () => void;
  isMobile?: boolean;
}

export function Sidebar({ onClose, isMobile = false }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({
    Products: true,
    Operations: true,
    Settings: true,
    Profile: false,
  });

  const toggleSection = (title: string) => {
    setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  return (
    <aside className={cn(
      "w-64 border-r border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col shrink-0 h-screen sticky top-0 z-20 select-none",
      isMobile && "h-full w-full"
    )}>
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200/80 dark:border-slate-800">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm shadow-indigo-600/30">
            <Boxes className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              StockSense
              <span className="text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 px-1.5 py-0.2 rounded">
                v1.0
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 font-medium leading-none">Inventory System</p>
          </div>
        </Link>
        {isMobile && onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 mb-2">
          Menu
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const hasChildren = item.children && item.children.length > 0;
          const isActive =
            pathname === item.href ||
            (hasChildren && item.children?.some((child) => pathname === child.href));
          const isOpen = openSections[item.title] ?? true;

          if (hasChildren) {
            return (
              <div key={item.title} className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => toggleSection(item.title)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer",
                    isActive
                      ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/30"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-900"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 text-slate-400" />
                    <span>{item.title}</span>
                  </div>
                  <ChevronDown
                    className={cn(
                      "w-3.5 h-3.5 text-slate-400 transition-transform duration-200",
                      isOpen && "rotate-180"
                    )}
                  />
                </button>

                {isOpen && (
                  <div className="pl-6 space-y-0.5 pt-0.5 border-l border-slate-200/70 dark:border-slate-800 ml-4">
                    {item.children?.map((child) => {
                      const ChildIcon = child.icon;
                      const isChildActive = pathname === child.href;

                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={isMobile ? onClose : undefined}
                          className={cn(
                            "flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors",
                            isChildActive
                              ? "bg-indigo-600 text-white dark:bg-indigo-600 shadow-xs font-semibold"
                              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-900"
                          )}
                        >
                          <ChildIcon className={cn("w-3.5 h-3.5", isChildActive ? "text-white" : "text-slate-400")} />
                          <span>{child.title}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={isMobile ? onClose : undefined}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors",
                isActive
                  ? "bg-indigo-600 text-white dark:bg-indigo-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-900"
              )}
            >
              <Icon className={cn("w-4 h-4", isActive ? "text-white" : "text-slate-400")} />
              <span>{item.title}</span>
            </Link>
          );
        })}
      </div>

      {/* Footer User Info */}
      <div className="p-3 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <Link
            href="/profile"
            onClick={isMobile ? onClose : undefined}
            className="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-80 transition-opacity"
          >
            <div className="w-7 h-7 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 flex items-center justify-center font-bold text-xs border border-indigo-200/60 dark:border-indigo-800 shrink-0">
              {user?.name ? user.name[0].toUpperCase() : "U"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                {user?.name || "User"}
              </p>
              <p className="text-[10px] text-slate-400 truncate">
                {user?.role === "INVENTORY_MANAGER" ? "Manager" : "Staff"}
              </p>
            </div>
          </Link>
          <button
            onClick={() => {
              if (isMobile && onClose) onClose();
              logout();
            }}
            title="Sign Out"
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-md transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
