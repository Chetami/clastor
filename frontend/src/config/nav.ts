import {
  LayoutDashboard,
  Users,
  CalendarDays,
  CreditCard,
  BookOpen,
  Settings,
  Globe,
  type LucideIcon,
} from "lucide-react";
import { isFeatureEnabled, type FeatureFlagKey } from "./features";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  feature?: FeatureFlagKey;
};

const allNavItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Students", href: "/students", icon: Users },
  { title: "Schedule", href: "/schedule", icon: CalendarDays },
  { title: "Payments", href: "/payments", icon: CreditCard },
  { title: "Lessons", href: "/lessons", icon: BookOpen },
  { title: "Public Profile", href: "/profile", icon: Globe, feature: "publicProfile" },
  { title: "Settings", href: "/settings", icon: Settings },
];

export const navItems = allNavItems.filter(
  (item) => !item.feature || isFeatureEnabled(item.feature),
);
