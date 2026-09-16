import SwiftUI

/// Week agenda view — the mobile counterpart of the web's schedule calendar.
/// Monday-anchored week window; tapping a lesson pushes LessonDetailView.
struct CalendarView: View {
    let session: SessionStore

    @State private var lessonAPI: any LessonServing = LessonAPI.live()
    @State private var studentsAPI: any StudentsServing = StudentsAPI.live()
    @State private var weekStart: Date
    @State private var lessons: [LessonModels.LessonResponse] = []
    @State private var studentNames: [String: String] = [:]
    @State private var isLoading = false
    @State private var hasLoaded = false
    @State private var message: String?
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
                        ForEach(day.lessons, id: \.id) { lesson in
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
            if isLoading && !hasLoaded {
                ProgressView("Loading…")
            } else if let message {
                ContentUnavailableView {
                    Label("Could not load schedule", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(message)
                } actions: {
                    Button("Try again") { Task { await load() } }
                        .buttonStyle(.borderedProminent)
                }
            } else if hasLoaded, lessons.isEmpty {
                ContentUnavailableView("No lessons this week", systemImage: "calendar",
                                        description: Text("Tap + to schedule one."))
            }
        }
        .task {
            if !hasLoaded { await load() }
        }
        .refreshable { await load() }
        .onChange(of: weekStart) {
            Task { await load() }
        }
        .onChange(of: showCreate) {
            // Refresh quietly after the create sheet closes.
            if !showCreate { Task { await load(isFatal: false) } }
        }
        .sheet(isPresented: $showCreate) {
            LessonFormView(session: session) {
                Task { await load(isFatal: false) }
            }
        }
    }

    // MARK: Pieces

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
        let student = studentNames[lesson.studentId] ?? "Lesson"
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
        for lesson in lessons {
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

    // MARK: Data

    @MainActor
    private func load(isFatal: Bool = true) async {
        guard !isLoading else { return }
        isLoading = true
        if isFatal { message = nil }
        defer { isLoading = false }
        do {
            let from = weekStart
            let to = weekEnd
            async let lessonsResult = session.authenticated { token in
                try await lessonAPI.list(filters: LessonListFilters(from: from, to: to), accessToken: token)
            }
            async let studentsResult = studentNames.isEmpty
                ? session.authenticated { token in try await studentsAPI.list(accessToken: token) }
                : nil
            let (loadedLessons, loadedStudents) = try await (lessonsResult, studentsResult)
            try Task.checkCancellation()
            lessons = loadedLessons
            if let loadedStudents {
                studentNames = Dictionary(loadedStudents.map { ($0.id, $0.name) }, uniquingKeysWith: { first, _ in first })
            }
            hasLoaded = true
        } catch is CancellationError {
        } catch AuthFailure.cancelled {
        } catch {
            if isFatal {
                lessons = []
                hasLoaded = false
                message = AuthFailure.message(for: error)
            }
        }
    }
}
