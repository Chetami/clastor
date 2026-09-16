import SwiftUI

/// Week agenda view — the mobile counterpart of the web's schedule calendar.
/// Monday-anchored week window served by the shared LessonStore; tapping a
/// lesson pushes LessonDetailView, whose mutations apply back into the cache.
struct CalendarView: View {
    let session: SessionStore

    @Environment(LessonStore.self) private var lessonStore
    @Environment(StudentStore.self) private var studentStore
    @State private var weekStart: Date
    @State private var showCreate = false

    private var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.firstWeekday = 2
        return calendar
    }

    init(session: SessionStore) {
        self.session = session
        var calendar = Calendar(identifier: .gregorian)
        calendar.firstWeekday = 2
        _weekStart = State(initialValue: calendar.dateInterval(of: .weekOfYear, for: Date())?.start ?? Date())
    }

    private var weekEnd: Date {
        calendar.date(byAdding: .day, value: 7, to: weekStart) ?? weekStart
    }

    var body: some View {
        List {
            Section {
                weekNavigator
                    .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                    .listRowBackground(Color.clear)
            }
            if let days = groupedDays, !days.isEmpty {
                ForEach(days, id: \.date) { day in
                    Section {
                        ForEach(day.lessons) { lesson in
                            NavigationLink(value: LessonRoute(id: lesson.id)) {
                                lessonRow(lesson)
                            }
                        }
                    } header: {
                        dayHeader(day.date)
                    }
                }
            }
        }
        .navigationTitle("Calendar")
        .accessibilityIdentifier("calendar.list")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showCreate = true
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityIdentifier("calendar.add")
            }
        }
        .overlay {
            if lessonStore.windowLessons.isEmpty {
                if let message = lessonStore.windowFailureMessage {
                    ContentUnavailableView {
                        Label("Could not load schedule", systemImage: "exclamationmark.triangle")
                    } description: {
                        Text(message)
                    } actions: {
                        Button("Try again") { Task { await load(force: true) } }
                            .buttonStyle(.borderedProminent)
                    }
                } else if lessonStore.windowLoaded {
                    ContentUnavailableView("No lessons this week", systemImage: "calendar",
                                            description: Text("Tap + to schedule one."))
                }
            }
        }
        .task {
            await load()
        }
        .refreshable { await load(force: true) }
        .onChange(of: weekStart) {
            Task { await load() }
        }
        .sheet(isPresented: $showCreate) {
            LessonFormView(session: session) {}
        }
    }

    // MARK: Pieces

    @MainActor
    private func load(force: Bool = false) async {
        await lessonStore.loadWindow(from: weekStart, to: weekEnd, session, force: force)
    }

    private var weekNavigator: some View {
        HStack {
            Button {
                shiftWeek(-1)
            } label: {
                Image(systemName: "chevron.left")
            }
            .accessibilityLabel("Previous week")
            Spacer()
            VStack(spacing: 2) {
                Text(weekTitle)
                    .font(.headline)
                if !calendar.isDate(weekStart, equalTo: Date(), toGranularity: .weekOfYear) {
                    Button("Today") { weekStart = calendar.dateInterval(of: .weekOfYear, for: Date())?.start ?? Date() }
                        .font(.caption)
                }
            }
            Spacer()
            Button {
                shiftWeek(1)
            } label: {
                Image(systemName: "chevron.right")
            }
            .accessibilityLabel("Next week")
        }
        .buttonStyle(.borderless)
    }

    private func shiftWeek(_ direction: Int) {
        weekStart = calendar.date(byAdding: .weekOfYear, value: direction, to: weekStart) ?? weekStart
    }

    private var weekTitle: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_AU_POSIX")
        formatter.dateFormat = "d MMM"
        let end = calendar.date(byAdding: .day, value: 6, to: weekStart) ?? weekStart
        return "\(formatter.string(from: weekStart)) – \(formatter.string(from: end))"
    }

    private func dayHeader(_ date: Date) -> some View {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_AU_POSIX")
        formatter.dateFormat = "EEE d MMM"
        return HStack {
            if calendar.isDateInToday(date) {
                Text("Today · \(formatter.string(from: date))")
            } else {
                Text(formatter.string(from: date))
            }
        }
    }

    private func lessonRow(_ lesson: LessonModels.LessonResponse) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 3) {
                Text(LessonDerivations.timeRange(for: lesson))
                    .font(.subheadline.weight(.medium))
                Text(rowTitle(lesson))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            if let badge = LessonDerivations.lessonStatusBadge(lesson) {
                BadgeView(label: badge.label, tone: badge.tone)
            }
        }
    }

    private func rowTitle(_ lesson: LessonModels.LessonResponse) -> String {
        let student = studentStore.namesByID[lesson.studentId] ?? "Lesson"
        if let subject = lesson.subject {
            return "\(subject) — \(student)"
        }
        return student
    }

    private struct DayGroup {
        let date: Date
        let lessons: [LessonModels.LessonResponse]
    }

    /// Days with at least one non-cancelled lesson, ascending.
    private var groupedDays: [DayGroup]? {
        var byDay: [Date: [LessonModels.LessonResponse]] = [:]
        for lesson in lessonStore.windowLessons {
            guard !(lesson.isCancelled ?? false),
                  let start = HomeDerivations.date(lesson.startDateTime)
            else { continue }
            let day = calendar.startOfDay(for: start)
            byDay[day, default: []].append(lesson)
        }
        return byDay.keys.sorted().map { day in
            DayGroup(date: day, lessons: (byDay[day] ?? []).sorted {
                (HomeDerivations.date($0.startDateTime) ?? .distantPast) <
                (HomeDerivations.date($1.startDateTime) ?? .distantPast)
            })
        }
    }
}
