import SwiftUI

struct HomeView: View {
    let session: SessionStore

    @Environment(StudentStore.self) private var studentStore
    @Environment(LessonStore.self) private var lessonStore
    @State private var summaryAPI: any HomeServing = HomeAPI.live()
    @State private var loadState = LoadState()
    @State private var period = "week"
    @State private var summary: HomeModels.DashboardSummaryResponse?
    @State private var markingLessonID: String?
    @State private var markFailed = false
    @State private var markFailureMessage: String?

    private var lessons: [LessonModels.LessonResponse] {
        lessonStore.allLessons
    }

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
        .loadStateOverlay(loadState, hasContent: summary != nil, errorTitle: "Could not load") {
            Task { await load() }
        }
        .task {
            if !loadState.isLoaded { await load() }
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
            // 2×2 grid like the web's mobile layout: Income, Hours, Lessons,
            // plus the money-owed tile surfaced from the same summary fetch.
            VStack(spacing: 12) {
                HStack(spacing: 12) {
                    statTile(
                        label: "Income",
                        value: HomeDerivations.formatCurrencyWhole(summary.income, currency: currency),
                        delta: HomeDerivations.deltaPercent(current: summary.income, previous: summary.previousIncome),
                        sub: "\(previousLabel): \(HomeDerivations.formatCurrencyWhole(summary.previousIncome, currency: currency))",
                        subColor: nil
                    )
                    statTile(
                        label: "Hours",
                        value: HomeDerivations.formatHours(summary.hoursWorked),
                        delta: HomeDerivations.deltaPercent(current: summary.hoursWorked, previous: summary.previousHoursWorked),
                        sub: "\(previousLabel): \(HomeDerivations.formatHours(summary.previousHoursWorked))",
                        subColor: nil
                    )
                }
                HStack(spacing: 12) {
                    statTile(
                        label: "Lessons",
                        value: "\(summary.lessonsTaught)",
                        delta: HomeDerivations.deltaPercent(current: Double(summary.lessonsTaught), previous: Double(summary.previousLessonsTaught)),
                        sub: "\(previousLabel): \(summary.previousLessonsTaught)",
                        subColor: nil
                    )
                    statTile(
                        label: "Owed",
                        value: HomeDerivations.formatCurrencyWhole(summary.outstandingAmount, currency: currency),
                        delta: nil,
                        sub: owedSubLine(summary),
                        subColor: summary.overdueAmount > 0 ? .red : nil
                    )
                }
            }
            .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
            .accessibilityIdentifier("home.stats")
        }
    }

    /// Sub-line for the owed tile: overdue warning, unbilled hint, or settled.
    private func owedSubLine(_ summary: HomeModels.DashboardSummaryResponse) -> String {
        if summary.overdueAmount > 0 {
            return "incl. \(HomeDerivations.formatCurrencyWhole(summary.overdueAmount, currency: currency)) overdue"
        }
        if summary.unbilledLessons > 0 {
            return "\(summary.unbilledLessons) lessons to invoice"
        }
        return "All settled"
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

    private func currentLessonRow(_ lesson: LessonModels.LessonResponse) -> some View {
        NavigationLink(value: LessonRoute(id: lesson.id)) {
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
    }

    private func nextLessonRow(_ lesson: LessonModels.LessonResponse) -> some View {
        NavigationLink(value: LessonRoute(id: lesson.id)) {
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

    private func attendanceRow(_ lesson: LessonModels.LessonResponse) -> some View {
        NavigationLink(value: LessonRoute(id: lesson.id)) {
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
    }

    // MARK: Pieces

    private func statTile(label: String, value: String, delta: Double?, sub: String, subColor: Color? = nil) -> some View {
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
                .foregroundStyle(subColor ?? Color(UIColor.tertiaryLabel))
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

    @ViewBuilder private func joinButton(_ lesson: LessonModels.LessonResponse) -> some View {
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

    private func studentName(_ lesson: LessonModels.LessonResponse) -> String {
        studentStore.namesByID[lesson.studentId] ?? "Student"
    }

    private func lessonTitle(_ lesson: LessonModels.LessonResponse) -> String {
        "\(studentName(lesson)) · \(lesson.subject ?? "Lesson")"
    }

    private func dayLabel(_ lesson: LessonModels.LessonResponse) -> String {
        guard let start = HomeDerivations.date(lesson.startDateTime) else { return "" }
        return HomeDerivations.relativeDayLabel(start)
    }

    // MARK: Data

    @MainActor
    private func load() async {
        await loadState.run {
            async let summaryResult = session.authenticated { token in
                try await summaryAPI.summary(period: period, accessToken: token)
            }
            async let lessonsResult = lessonStore.loadAllIfNeeded(session)
            async let studentsResult = studentStore.loadIfNeeded(session)
            let (loadedSummary, _, _) = try await (summaryResult, lessonsResult, studentsResult)
            summary = loadedSummary
        }
    }

    @MainActor
    private func loadSummary() async {
        // Keep showing the previous data if a period switch fails to load.
        guard let loaded = try? await session.authenticated({ token in
            try await summaryAPI.summary(period: period, accessToken: token)
        }) else { return }
        summary = loaded
    }

    @MainActor
    private func mark(_ lesson: LessonModels.LessonResponse, status: String) async {
        guard markingLessonID == nil else { return }
        markingLessonID = lesson.id
        defer { markingLessonID = nil }
        do {
            // The store applies the update to its caches; observation
            // re-renders the todo list without manual patching here.
            _ = try await lessonStore.recordAttendance(id: lesson.id, status: status, session)
            await loadSummary()
        } catch is CancellationError {
        } catch AuthFailure.cancelled {
        } catch {
            markFailureMessage = AuthFailure.message(for: error)
            markFailed = true
        }
    }
}
