import SwiftUI

struct HomeView: View {
    let session: SessionStore

    @State private var api: any HomeServing = HomeAPI.live()
    @State private var studentsAPI: any StudentsServing = StudentsAPI.live()
    @State private var period = "week"
    @State private var summary: HomeModels.DashboardSummaryResponse?
    @State private var lessons: [HomeModels.LessonResponse] = []
    @State private var studentNames: [String: String] = [:]
    @State private var isLoading = false
    @State private var hasLoaded = false
    @State private var message: String?
    @State private var markingLessonID: String?
    @State private var markFailed = false
    @State private var markFailureMessage: String?

    var body: some View {
        List {
            Picker("Period", selection: $period) {
                Text("Week").tag("week")
                Text("Month").tag("month")
            }
            .pickerStyle(.segmented)
            .listRowBackground(Color.clear)
            .accessibilityIdentifier("home.periodPicker")

            if let summary {
                statsSection(summary)
            }
            lessonSections
            attendanceSection
        }
        .navigationTitle("Home")
        .accessibilityIdentifier("home.list")
        .overlay {
            if isLoading && !hasLoaded {
                ProgressView("Loading…")
            } else if let message {
                ContentUnavailableView {
                    Label("Could not load", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(message)
                } actions: {
                    Button("Try again") { Task { await load() } }
                        .buttonStyle(.borderedProminent)
                }
                .accessibilityIdentifier("home.error")
            }
        }
        .task {
            if !hasLoaded { await load() }
        }
        .refreshable { await load() }
        .onChange(of: period) {
            Task { await loadSummary() }
        }
        .alert("Could not save attendance", isPresented: $markFailed) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(markFailureMessage ?? "Please try again.")
        }
    }

    // MARK: Sections

    private func statsSection(_ summary: HomeModels.DashboardSummaryResponse) -> some View {
        Section {
            HStack(spacing: 12) {
                statTile(
                    label: "Income",
                    value: HomeDerivations.formatCurrencyWhole(summary.income, currency: currency),
                    delta: HomeDerivations.deltaPercent(current: summary.income, previous: summary.previousIncome),
                    sub: "\(previousLabel): \(HomeDerivations.formatCurrencyWhole(summary.previousIncome, currency: currency))"
                )
                statTile(
                    label: "Hours",
                    value: HomeDerivations.formatHours(summary.hoursWorked),
                    delta: HomeDerivations.deltaPercent(current: summary.hoursWorked, previous: summary.previousHoursWorked),
                    sub: "\(previousLabel): \(HomeDerivations.formatHours(summary.previousHoursWorked))"
                )
                statTile(
                    label: "Lessons",
                    value: "\(summary.lessonsTaught)",
                    delta: HomeDerivations.deltaPercent(current: Double(summary.lessonsTaught), previous: Double(summary.previousLessonsTaught)),
                    sub: "\(previousLabel): \(summary.previousLessonsTaught)"
                )
            }
            .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
            .accessibilityIdentifier("home.stats")
        }
    }

    @ViewBuilder private var lessonSections: some View {
        let now = Date()
        if let current = HomeDerivations.findCurrentLesson(lessons, now: now) {
            Section {
                currentLessonRow(current)
                    .accessibilityIdentifier("home.currentLesson")
            }
        }
        if let next = HomeDerivations.nextLesson(lessons, now: now) {
            Section("Next lesson") {
                nextLessonRow(next)
                    .accessibilityIdentifier("home.nextLesson")
            }
        }
    }

    private func currentLessonRow(_ lesson: HomeModels.LessonResponse) -> some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 4) {
                Label("Live now", systemImage: "record.circle")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.red)
                Text(lessonTitle(lesson))
                    .font(.subheadline.weight(.medium))
                Text(HomeDerivations.lessonTimeRange(lesson))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            joinButton(lesson)
        }
    }

    private func nextLessonRow(_ lesson: HomeModels.LessonResponse) -> some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 4) {
                if let start = HomeDerivations.date(lesson.startDateTime) {
                    TimelineView(.periodic(from: .now, by: 30)) { context in
                        Text(HomeDerivations.timeUntil(start, now: context.date))
                            .font(.title3.weight(.semibold))
                    }
                }
                Text("\(dayLabel(lesson)) · \(HomeDerivations.lessonTimeRange(lesson))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(lessonTitle(lesson))
                    .font(.subheadline.weight(.medium))
            }
            Spacer()
            joinButton(lesson)
        }
    }

    private var attendanceSection: some View {
        Section {
            let todos = HomeDerivations.todoLessons(lessons)
            if todos.isEmpty {
                Label("All caught up", systemImage: "checkmark.circle.fill")
                    .foregroundStyle(.green)
                    .accessibilityIdentifier("home.caughtUp")
            } else {
                ForEach(todos, id: \.id) { lesson in
                    attendanceRow(lesson)
                }
            }
        } header: {
            Text("Things to do")
        }
    }

    private func attendanceRow(_ lesson: HomeModels.LessonResponse) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(studentName(lesson))
                Text("\(lesson.subject ?? "Lesson") · \(dayLabel(lesson)) · \(HomeDerivations.lessonTimeRange(lesson))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            if markingLessonID == lesson.id {
                ProgressView()
            } else {
                Menu {
                    Button("Present") { Task { await mark(lesson, status: "present") } }
                    Button("Late") { Task { await mark(lesson, status: "present_late") } }
                    Button("Absent") { Task { await mark(lesson, status: "absent_no_makeup") } }
                } label: {
                    Text("Mark")
                        .font(.callout.weight(.medium))
                }
                .accessibilityIdentifier("home.mark.\(lesson.id)")
            }
        }
    }

    // MARK: Pieces

    private func statTile(label: String, value: String, delta: Double?, sub: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.headline)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            deltaView(delta)
            Text(sub)
                .font(.caption2)
                .foregroundStyle(.tertiary)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder private func deltaView(_ delta: Double?) -> some View {
        if let delta {
            let rounded = Int(delta.rounded())
            HStack(spacing: 2) {
                Image(systemName: delta > 0 ? "arrow.up.right" : delta < 0 ? "arrow.down.right" : "minus")
                Text("\(abs(rounded))%")
            }
            .font(.caption2.weight(.medium))
            .foregroundStyle(delta > 0 ? .green : delta < 0 ? .red : .secondary)
        }
    }

    @ViewBuilder private func joinButton(_ lesson: HomeModels.LessonResponse) -> some View {
        if let meetLink = lesson.meetLink, let url = URL(string: meetLink) {
            Link("Join", destination: url)
                .buttonStyle(.borderedProminent)
                .controlSize(.small)
        }
    }

    // MARK: Helpers

    private var currency: String {
        if case .signedIn(let user) = session.phase { return user.currency ?? "AUD" }
        return "AUD"
    }

    private var previousLabel: String {
        HomeDerivations.previousPeriodLabel(period)
    }

    private func studentName(_ lesson: HomeModels.LessonResponse) -> String {
        studentNames[lesson.studentId] ?? "Student"
    }

    private func lessonTitle(_ lesson: HomeModels.LessonResponse) -> String {
        "\(studentName(lesson)) · \(lesson.subject ?? "Lesson")"
    }

    private func dayLabel(_ lesson: HomeModels.LessonResponse) -> String {
        guard let start = HomeDerivations.date(lesson.startDateTime) else { return "" }
        return HomeDerivations.relativeDayLabel(start)
    }

    // MARK: Data

    @MainActor
    private func load() async {
        guard !isLoading else { return }
        isLoading = true
        message = nil
        defer { isLoading = false }
        do {
            async let summaryResult = session.authenticated { token in
                try await api.summary(period: period, accessToken: token)
            }
            async let lessonsResult = session.authenticated { token in
                try await api.lessons(accessToken: token)
            }
            async let studentsResult = session.authenticated { token in
                try await studentsAPI.list(accessToken: token)
            }
            let (loadedSummary, loadedLessons, loadedStudents) = try await (summaryResult, lessonsResult, studentsResult)
            try Task.checkCancellation()
            summary = loadedSummary
            lessons = loadedLessons
            studentNames = Dictionary(loadedStudents.map { ($0.id, $0.name) }, uniquingKeysWith: { first, _ in first })
            hasLoaded = true
        } catch is CancellationError {
            // Leaving the tab or signing out must not publish a late response.
        } catch AuthFailure.cancelled {
        } catch {
            summary = nil
            lessons = []
            studentNames = [:]
            hasLoaded = false
            message = AuthFailure.message(for: error)
        }
    }

    @MainActor
    private func loadSummary() async {
        // Keep showing the previous data if a period switch fails to load.
        guard let loaded = try? await session.authenticated({ token in
            try await api.summary(period: period, accessToken: token)
        }) else { return }
        summary = loaded
    }

    @MainActor
    private func mark(_ lesson: HomeModels.LessonResponse, status: String) async {
        guard markingLessonID == nil else { return }
        markingLessonID = lesson.id
        defer { markingLessonID = nil }
        do {
            let updated = try await session.authenticated { token in
                try await api.recordAttendance(id: lesson.id, status: status, accessToken: token)
            }
            if let index = lessons.firstIndex(where: { $0.id == updated.id }) {
                lessons[index] = updated
            }
            if let loaded = try? await session.authenticated({ token in
                try await api.summary(period: period, accessToken: token)
            }) {
                summary = loaded
            }
        } catch is CancellationError {
        } catch AuthFailure.cancelled {
        } catch {
            markFailureMessage = AuthFailure.message(for: error)
            markFailed = true
        }
    }
}
