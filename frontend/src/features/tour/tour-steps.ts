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
        "Here's how to get set up in about a minute. You can skip anytime.",
    },
  },
  {
    route: "/students",
    element: '[data-tour="add-student"]',
    popover: {
      title: "Add a student",
      description:
        "To get started, add a student here to track their lessons, rate and balance.",
    },
  },
  {
    route: "/schedule",
    element: '[data-tour="schedule"]',
    popover: {
      title: "Book a lesson",
      description:
        "Drag across a time slot on the calendar to schedule a lesson.",
    },
  },
  {
    route: "/payments",
    element: '[data-tour="create-invoice"]',
    popover: {
      title: "Invoices",
      description: "Turn completed lessons into invoices here.",
    },
  },
  {
    route: "/dashboard",
    element: '[data-tour="things-to-do"]',
    popover: {
      title: "Things to do",
      description:
        "After a lesson, mark attendance here and invoice it in one click.",
    },
  },
  {
    popover: {
      title: "You're set",
      description:
        "That's the core loop. Add your students and book your first lesson to get going!",
    },
  },
];
