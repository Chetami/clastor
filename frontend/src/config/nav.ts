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

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

export const navItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Students", href: "/students", icon: Users },
  { title: "Schedule", href: "/schedule", icon: CalendarDays },
  { title: "Payments", href: "/payments", icon: CreditCard },
  { title: "Lessons", href: "/lessons", icon: BookOpen },
  { title: "Public Profile", href: "/profile", icon: Globe },
  { title: "Settings", href: "/settings", icon: Settings },
];
