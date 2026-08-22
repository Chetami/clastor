import { useEffect, useMemo, useState } from "react";
import { Globe, MapPin, Search } from "lucide-react";
import type { PublicTutorSummary } from "@examify-tms/interfaces";
import { listPublicTutors } from "@/lib/public-api";
import { Stars, SubjectChips, TutorAvatar } from "@/components/tutor/blocks";
import { cn } from "@/lib/utils";

const FIELD =
  "w-full rounded-2xl border-[2.5px] border-foreground bg-card px-4 py-2.5 text-base text-foreground placeholder:text-muted-foreground/70 transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-brand/30";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function TutorCard({ tutor }: { tutor: PublicTutorSummary }) {
  return (
    <a
      href={`/t/${tutor.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border-2 border-foreground bg-card shadow-sketch transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-sketch-lg"
    >
      {/* Compact square photo — the tutor's face stays the anchor without
          eating vertical space. */}
      <TutorAvatar
        name={tutor.name}
        avatarUrl={tutor.avatarUrl}
        className="aspect-square w-full rounded-none border-0 text-3xl"
      />

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <p className="truncate font-display text-base leading-tight">
          {tutor.name}
        </p>

        {(tutor.ratingAvg != null || tutor.hourlyRate != null) && (
          <div className="flex items-center justify-between gap-2">
            <Stars ratingAvg={tutor.ratingAvg} reviewCount={tutor.reviewCount} />
            {tutor.hourlyRate != null && (
              <span className="text-sm font-semibold">
                {tutor.currency} {tutor.hourlyRate.toFixed(0)}/hr
              </span>
            )}
          </div>
        )}

        {tutor.bio && (
          <p className="line-clamp-1 text-sm text-muted-foreground">
            {tutor.bio}
          </p>
        )}

        {tutor.subjects.length > 0 && (
          <SubjectChips subjects={tutor.subjects} max={2} className="text-xs" />
        )}

        {(tutor.location || tutor.teachesOnline) && (
          <div className="mt-auto flex flex-wrap items-center gap-x-2.5 gap-y-0.5 pt-0.5 text-xs text-muted-foreground">
            {tutor.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3" />
                {tutor.location}
              </span>
            )}
            {tutor.teachesOnline && (
              <span className="inline-flex items-center gap-1">
                <Globe className="size-3" />
                Online
              </span>
            )}
          </div>
        )}
      </div>
    </a>
  );
}

function CardSkeleton() {
  return (
    <div className="flex animate-pulse flex-col overflow-hidden rounded-2xl border-2 border-border bg-card">
      <div className="aspect-square w-full bg-muted" />
      <div className="space-y-1.5 p-3">
        <div className="h-4 w-28 rounded bg-muted" />
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-2/3 rounded bg-muted" />
      </div>
    </div>
  );
}

/**
 * Public tutor directory — lives on the marketing site so search engines
 * index it under the root domain. Data comes from the backend's public
 * directory endpoint (same one the app uses).
 */
export default function TutorsDirectoryPage() {
  const [search, setSearch] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [maxRate, setMaxRate] = useState("");
  const [sort, setSort] = useState<"recent" | "rating">("recent");

  const debouncedSearch = useDebouncedValue(search, 300);
  const debouncedMaxRate = useDebouncedValue(maxRate, 300);

  const query = useMemo(
    () => ({
      search: debouncedSearch.trim() || undefined,
      online: onlineOnly || undefined,
      maxRate: debouncedMaxRate ? Number(debouncedMaxRate) : undefined,
      sort,
      limit: 48,
    }),
    [debouncedSearch, onlineOnly, debouncedMaxRate, sort],
  );

  const [state, setState] = useState<{
    loading: boolean;
    error: string | null;
    items: PublicTutorSummary[];
    total: number | null;
  }>({ loading: true, error: null, items: [], total: null });

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    listPublicTutors(query)
      .then((result) => {
        if (cancelled) return;
        setState({ loading: false, error: null, items: result.items, total: result.total });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ loading: false, error: "Couldn't load tutors right now.", items: [], total: null });
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const showSkeleton = state.loading && state.items.length === 0;

  return (
    <section className="mx-auto max-w-[1180px] px-5 pb-24 pt-36 sm:px-6 lg:px-9">
      <div className="max-w-2xl">
        <p className="eyebrow">Tutor directory</p>
        <h1 className="mt-3 font-display text-[clamp(2.5rem,6vw,3.75rem)] leading-tight tracking-tightest">
          Find a tutor
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Browse independent tutors for one-on-one lessons — online or in
          person. Every tutor runs on Clastor, so scheduling and payments are
          handled for you.
        </p>
      </div>

      <form
        className="mt-8 grid gap-3 rounded-3xl border-[2.5px] border-foreground bg-secondary/40 p-4 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(e) => e.preventDefault()}
      >
        <div className="relative sm:col-span-2">
          <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            aria-label="Search tutors"
            placeholder="Name, subject or keyword…"
            className={cn(FIELD, "pl-11")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <input
          type="number"
          min="0"
          aria-label="Maximum hourly rate"
          placeholder="Max rate / hr"
          className={FIELD}
          value={maxRate}
          onChange={(e) => setMaxRate(e.target.value)}
        />
        <div className="flex gap-2" role="group" aria-label="Sort by">
          {(
            [
              { value: "recent", label: "Newest" },
              { value: "rating", label: "Top rated" },
            ] as const
          ).map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setSort(value)}
              aria-pressed={sort === value}
              className={cn(
                "flex-1 rounded-2xl border-[2.5px] px-3 text-sm font-medium transition-all",
                sort === value
                  ? "border-foreground bg-brand shadow-sketch"
                  : "border-foreground bg-card hover:bg-secondary",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-3 sm:col-span-2 lg:col-span-4">
          <input
            type="checkbox"
            checked={onlineOnly}
            onChange={(e) => setOnlineOnly(e.target.checked)}
            className="size-5 accent-[hsl(var(--brand))]"
          />
          <span className="text-base">Online lessons only</span>
        </label>
      </form>

      <p className="mt-6 font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground" aria-live="polite">
        {state.loading
          ? "Searching…"
          : state.error
            ? state.error
            : state.total != null
              ? `${state.total} ${state.total === 1 ? "tutor" : "tutors"} found`
              : ""}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
        {showSkeleton &&
          Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}

        {!state.loading && state.items.length === 0 && !state.error && (
          <div className="rounded-3xl border-[2.5px] border-dashed border-border bg-card p-10 text-center sm:col-span-2 lg:col-span-3">
            <p className="font-display text-xl">No tutors match your filters</p>
            <p className="mt-1 text-muted-foreground">
              Try clearing the search or raising the max rate.
            </p>
            <button
              type="button"
              className="mt-4 rounded-full border-[2.5px] border-foreground bg-card px-6 py-2 shadow-sketch transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-sketch-lg"
              onClick={() => {
                setSearch("");
                setOnlineOnly(false);
                setMaxRate("");
              }}
            >
              Clear filters
            </button>
          </div>
        )}

        {state.items.map((tutor) => (
          <TutorCard key={tutor.slug} tutor={tutor} />
        ))}
      </div>
    </section>
  );
}
