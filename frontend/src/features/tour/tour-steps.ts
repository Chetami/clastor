/**
 * Ordered product-tour steps. `element` is a CSS selector for the highlight
 * target; omit it for a screen-centered popover. `route` is the app route the
 * element lives on — the tour controller navigates there before highlighting.
 *
 * Selectors lean on shadcn sidebar's stable `data-sidebar` attributes and the
 * `data-tour="..."` anchors added to key CTAs.
 */
export interface TourStep {
  route?: string;
  element?: string;
  popover: { title: string; description: string };
}

export const TOUR_STEPS: TourStep[] = [
  {
    popover: {
      title: "Welcome to Clastor",
      description:
        "Here's a quick tour of what you can do. This takes about a minute — you can skip anytime.",
    },
  },
  {
    element: '[data-sidebar="menu-button"][href="/students"]',
    popover: {
      title: "The sidebar",
      description:
        "Jump between Students, Schedule, Payments and Lessons from the sidebar, anytime.",
    },
  },
  {
    route: "/dashboard",
    element: '[data-tour="quick-actions"]',
    popover: {
      title: "Quick actions",
      description:
        "Add a student, schedule a lesson, or create an invoice in a single click from your dashboard.",
    },
  },
  {
    route: "/students",
    element: '[data-tour="add-student"]',
    popover: {
      title: "Your students",
      description:
        "Add students here and keep track of their lessons, rates and contact details.",
    },
  },
  {
    route: "/schedule",
    element: '[data-tour="schedule"]',
    popover: {
      title: "Your schedule",
      description:
        "Drag or select a time slot on the calendar to book a lesson. Connected Google accounts get Meet links automatically.",
    },
  },
  {
    route: "/payments",
    element: '[data-tour="create-invoice"]',
    popover: {
      title: "Invoices & payments",
      description:
        "Create invoices and accept card payments that settle straight to your bank via Stripe.",
    },
  },
  {
    route: "/dashboard",
    element: '[data-tour="theme-toggle"]',
    popover: {
      title: "Make it yours",
      description:
        "Toggle light/dark or pick a colour scheme in Settings anytime. That's the tour — happy tutoring!",
    },
  },
];
