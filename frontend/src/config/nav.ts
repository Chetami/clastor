import {
  LayoutDashboard,
  Users,
  FileText,
  CalendarDays,
  Settings,
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
  { title: "Exams", href: "/exams", icon: FileText },
  { title: "Schedule", href: "/schedule", icon: CalendarDays },
  { title: "Settings", href: "/settings", icon: Settings },
];
