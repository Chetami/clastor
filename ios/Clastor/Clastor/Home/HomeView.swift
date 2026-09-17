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
    @State private var markSuccessCount = 0

    /// The one true padding: every edge of this screen sits on the same grid.
    private static let pad: CGFloat = 20
    private static let gap: CGFloat = 12

    private var lessons: [LessonModels.LessonResponse] {
        lessonStore.allLessons
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: Self.gap) {
                greetingHeader
                    .padding(.bottom, 4)

                if let summary {
                    incomeCard(summary)
                    statCards(summary)
                    owedCard(summary)
                }

                lessonSections
                attendanceSection

                ComingSoonView(icon: "chart.xyaxis.line", title: "Attendance trends")
                    .padding(.top, 4)
            }
            .padding(.horizontal, Self.pad)
            .padding(.top, 8)
            .padding(.bottom, 24)
        }
        .scrollBounceBehavior(.basedOnSize)
        // No nav title — the greeting header is the title; the bar carries
        // only the period switcher.
        .toolbarBackground(.hidden, for: .navigationBar)
        .background(ClastorTheme.background)
        .accessibilityIdentifier("home.list")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                periodMenu
            }
        }
        .sensoryFeedback(.success, trigger: markSuccessCount)
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

    // MARK: Header

    private var greetingHeader: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(greetingText)
                .font(.title2.weight(.semibold))
                .foregroundStyle(ClastorTheme.ink)
            Text(greetingDate)
                .font(.subheadline)
                .foregroundStyle(ClastorTheme.mutedInk)
        }
    }

    private var greetingText: String {
        let hour = Calendar.current.component(.hour, from: Date())
        let part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
        if case .signedIn(let user) = session.phase,
           let name = user.name?.split(separator: " ").first {
            return "\(part), \(name)"
        }
        return part
    }

    private var greetingDate: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_AU_POSIX")
        formatter.dateFormat = "EEEE d MMMM"
        return formatter.string(from: Date())
    }

    private var periodMenu: some View {
        Menu {
            Picker("Period", selection: $period) {
                Text("This week").tag("week")
                Text("This month").tag("month")
            }
        } label: {
            Label(period == "week" ? "Week" : "Month", systemImage: "chevron.up.chevron.down")
                .font(.subheadline.weight(.medium))
        }
        .accessibilityIdentifier("home.periodPicker")
    }

    // MARK: Stat cards

    /// Hero income card — label, big number, delta, then the chart with room
    /// to breathe (the series the backend already serves, previously hidden).
    private func incomeCard(_ summary: HomeModels.DashboardSummaryResponse) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 3) {
                Text("Income · \(period == "week" ? "this week" : "this month")")
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(ClastorTheme.mutedInk)
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(HomeDerivations.formatCurrencyWhole(summary.income, currency: currency))
                        .font(.title.bold())
                        .foregroundStyle(ClastorTheme.ink)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                    deltaChip(HomeDerivations.deltaPercent(
                        current: summary.income,
                        previous: summary.previousIncome))
                }
            }
            MiniBarChart(
                current: summary.incomeSeries.map(\.value),
                previous: summary.previousIncomeSeries.map(\.value))
        }
        .clastorCard()
        .accessibilityIdentifier("home.incomeCard")
    }

    private func statCards(_ summary: HomeModels.DashboardSummaryResponse) -> some View {
        HStack(alignment: .top, spacing: Self.gap) {
            compactStat(
                label: "Hours",
                value: HomeDerivations.formatHours(summary.hoursWorked),
                delta: HomeDerivations.deltaPercent(current: summary.hoursWorked, previous: summary.previousHoursWorked),
                chart: summary.hoursSeries.map(\.value))
            compactStat(
                label: "Lessons",
                value: "\(summary.lessonsTaught)",
                delta: HomeDerivations.deltaPercent(
                    current: Double(summary.lessonsTaught),
                    previous: Double(summary.previousLessonsTaught)),
                chart: nil)
        }
        .accessibilityIdentifier("home.stats")
    }

    private func compactStat(label: String, value: String, delta: Double?, chart: [Double]?) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label)
                .font(.footnote.weight(.medium))
                .foregroundStyle(ClastorTheme.mutedInk)
            Text(value)
                .font(.title3.weight(.semibold))
                .foregroundStyle(ClastorTheme.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            if let chart, !chart.isEmpty {
                MiniBarChart(current: chart, tint: ClastorTheme.mutedInk, height: 32)
            } else {
                deltaChip(delta)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 118, alignment: .topLeading)
        .clastorCard()
    }

    private func owedCard(_ summary: HomeModels.DashboardSummaryResponse) -> some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text("Owed to you")
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(ClastorTheme.mutedInk)
                Text(HomeDerivations.formatCurrencyWhole(summary.outstandingAmount, currency: currency))
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(summary.overdueAmount > 0 ? .red : ClastorTheme.ink)
            }
            Spacer()
            Text(owedSubLine(summary))
                .font(.footnote)
                .foregroundStyle(summary.overdueAmount > 0 ? .red : ClastorTheme.mutedInk)
                .multilineTextAlignment(.trailing)
        }
        .clastorCard()
        .accessibilityIdentifier("home.owedCard")
    }

    /// Sub-line for the owed card: overdue warning, unbilled hint, or settled.
    private func owedSubLine(_ summary: HomeModels.DashboardSummaryResponse) -> String {
        if summary.overdueAmount > 0 {
            return "incl. \(HomeDerivations.formatCurrencyWhole(summary.overdueAmount, currency: currency)) overdue"
        }
        if summary.unbilledLessons > 0 {
            return "\(summary.unbilledLessons) lessons to invoice"
        }
        return "All settled"
    }

    // MARK: Lesson & todo sections

    @ViewBuilder private var lessonSections: some View {
        let now = Date()
        if let current = HomeDerivations.findCurrentLesson(lessons, now: now) {
            sectionCard(title: "Happening now") {
                currentLessonRow(current)
            }
            .accessibilityIdentifier("home.currentLesson")
        }
        if let next = HomeDerivations.nextLesson(lessons, now: now) {
            sectionCard(title: "Next lesson") {
                nextLessonRow(next)
            }
            .accessibilityIdentifier("home.nextLesson")
        }
    }

    private var attendanceSection: some View {
        let todos = HomeDerivations.todoLessons(lessons)
        return sectionCard(title: "Things to do") {
            if todos.isEmpty {
                Label("All caught up", systemImage: "checkmark.circle.fill")
                    .font(.subheadline)
                    .foregroundStyle(.green)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .accessibilityIdentifier("home.caughtUp")
            } else {
                attendanceRows(todos)
            }
        }
    }

    /// Card + small-caps section title, sitting on the same 20pt grid.
    private func sectionCard<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(title.uppercased())
                .font(.footnote.weight(.semibold))
                .foregroundStyle(ClastorTheme.mutedInk)
                .padding(.bottom, 4)
            VStack(alignment: .leading, spacing: 0) {
                content()
            }
            .clastorCard()
        }
    }

    /// Hairline divider between grouped rows, inset to align with content.
    private func rowDivider() -> some View {
        Rectangle()
            .fill(ClastorTheme.border)
            .frame(height: 0.5)
            .padding(.vertical, 10)
    }

    private func currentLessonRow(_ lesson: LessonModels.LessonResponse) -> some View {
        NavigationLink(value: LessonRoute(id: lesson.id)) {
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Label("Live now", systemImage: "record.circle")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.red)
                    Text(lessonTitle(lesson))
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(ClastorTheme.ink)
                    Text(HomeDerivations.lessonTimeRange(lesson))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                joinButton(lesson)
            }
        }
        .buttonStyle(.plain)
    }

    private func nextLessonRow(_ lesson: LessonModels.LessonResponse) -> some View {
        NavigationLink(value: LessonRoute(id: lesson.id)) {
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    if let start = HomeDerivations.date(lesson.startDateTime) {
                        TimelineView(.periodic(from: .now, by: 30)) { context in
                            Text(HomeDerivations.timeUntil(start, now: context.date))
                                .font(.title3.weight(.semibold))
                                .foregroundStyle(ClastorTheme.ink)
                        }
                    }
                    Text("\(dayLabel(lesson)) · \(HomeDerivations.lessonTimeRange(lesson))")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(lessonTitle(lesson))
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(ClastorTheme.ink)
                }
                Spacer()
                joinButton(lesson)
            }
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder private func attendanceRows(_ todos: [LessonModels.LessonResponse]) -> some View {
        ForEach(Array(todos.enumerated()), id: \.element.id) { index, lesson in
            if index > 0 { rowDivider() }
            attendanceRow(lesson)
        }
    }

    private func attendanceRow(_ lesson: LessonModels.LessonResponse) -> some View {
        NavigationLink(value: LessonRoute(id: lesson.id)) {
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(studentName(lesson))
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(ClastorTheme.ink)
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
                            .foregroundStyle(Color.accentColor)
                    }
                    .accessibilityIdentifier("home.mark.\(lesson.id)")
                }
            }
        }
        .buttonStyle(.plain)
    }

    // MARK: Pieces

    @ViewBuilder private func deltaChip(_ delta: Double?) -> some View {
        if let delta {
            let rounded = Int(delta.rounded())
            HStack(spacing: 2) {
                Image(systemName: delta > 0 ? "arrow.up.right" : delta < 0 ? "arrow.down.right" : "minus")
                Text("\(abs(rounded))%")
            }
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .foregroundStyle(delta > 0 ? .green : delta < 0 ? .red : ClastorTheme.mutedInk)
            .background(
                (delta > 0 ? Color.green : delta < 0 ? Color.red : ClastorTheme.mutedInk).opacity(0.12),
                in: Capsule())
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
            markSuccessCount += 1
            await loadSummary()
        } catch is CancellationError {
        } catch AuthFailure.cancelled {
        } catch {
            markFailureMessage = AuthFailure.message(for: error)
            markFailed = true
        }
    }
}
