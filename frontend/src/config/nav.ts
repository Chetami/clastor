import {
  LayoutDashboard,
  Users,
  CalendarDays,
  CreditCard,
  BookOpen,
  Settings,
  Globe,
  MessageSquareText,
  GraduationCap,
  LayoutTemplate,
  Contact,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@examify-tms/interfaces";
import { isFeatureEnabled, type FeatureFlagKey } from "./features";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  feature?: FeatureFlagKey;
  roles?: Role[];
  /** Only show when an organisation is active in the switcher. */
  orgOnly?: boolean;
};

const allNavItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  {
    title: "Tutors",
    href: "/tutors",
    icon: Contact,
    roles: ["tutor"],
    orgOnly: true,
  },
  { title: "Students", href: "/students", icon: Users, roles: ["tutor"] },
  { title: "Schedule", href: "/schedule", icon: CalendarDays, roles: ["tutor"] },
  { title: "Lessons", href: "/lessons", icon: BookOpen, roles: ["tutor"] },
  { title: "Payments", href: "/payments", icon: CreditCard, roles: ["tutor"] },
  { title: "Templates", href: "/templates", icon: LayoutTemplate, roles: ["tutor"] },
  {
    title: "Public Profile",
    href: "/profile",
    icon: Globe,
    feature: "publicProfile",
    roles: ["tutor"],
  },
  {
    title: "Feedback",
    href: "/admin/feedback",
    icon: MessageSquareText,
    roles: ["system_admin"],
  },
  {
    title: "Tutors",
    href: "/admin/tutors",
    icon: GraduationCap,
    roles: ["system_admin"],
  },
  { title: "Settings", href: "/settings", icon: Settings, roles: ["tutor"] },
];

export const navItems = allNavItems.filter(
  (item) => !item.feature || isFeatureEnabled(item.feature),
);
