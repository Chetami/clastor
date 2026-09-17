import SwiftUI

/// Apple-Calendar-style schedule: fullscreen 3-day timeline, swipe or use the
/// chevrons to page left/right, tapping an event opens its detail as a sheet.
struct CalendarView: View {
    let session: SessionStore

    @Environment(LessonStore.self) private var lessonStore
    @Environment(StudentStore.self) private var studentStore
    /// First day of the visible 3-day page; pages step by 3 days.
    @State private var pageAnchor: Date
    @State private var selectedLesson: LessonModels.LessonResponse?
    @State private var showCreate = false

    private static let hourHeight: CGFloat = 56
    private static let gutter: CGFloat = 46

    private static var mondayCalendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.firstWeekday = 2
        return calendar
    }

    init(session: SessionStore) {
        self.session = session
        let calendar = Self.mondayCalendar
        // Anchor the first page on today, aligned so today is the first day.
        _pageAnchor = State(initialValue: calendar.startOfDay(for: Date()))
    }

    private var calendar: Calendar { Self.mondayCalendar }

    private var pageDays: [Date] {
        (0..<3).compactMap { calendar.date(byAdding: .day, value: $0, to: pageAnchor) }
    }

    private var windowStart: Date {
        // Pad ±3 days beyond the anchor week so the pager's edge pages
        // (anchor ±3 days) always have data.
        let weekStart = calendar.dateInterval(of: .weekOfYear, for: pageAnchor)?.start ?? pageAnchor
        return calendar.date(byAdding: .day, value: -3, to: weekStart) ?? pageAnchor
    }

    private var windowEnd: Date {
        calendar.date(byAdding: .day, value: 10, to: windowStart) ?? windowStart
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            DayPager(
                anchor: pageAnchor,
                hourHeight: Self.hourHeight,
                gutter: Self.gutter,
                calendar: calendar,
                lessonsByDay: lessonsByDay(days: pageDays),
                studentNames: studentStore.namesByID,
                onShift: { direction in
                    shift(direction)
                },
                onTapLesson: { lesson in
                    selectedLesson = lesson
                })
        }
        .toolbar(.hidden, for: .navigationBar)
        .background(ClastorTheme.background)
        .accessibilityIdentifier("calendar.timeline")
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
        .onChange(of: pageAnchor) {
            Task { await load() }
        }
        .sheet(item: $selectedLesson) { lesson in
            NavigationStack {
                LessonDetailView(session: session, lessonID: lesson.id)
            }
        }
        .sheet(isPresented: $showCreate) {
            LessonFormView(session: session) {}
        }
    }

    // MARK: Chrome

    /// Custom fullscreen chrome (system nav bar hidden below): month title,
    /// Today, page chevrons, and the day column headers.
    private var header: some View {
        VStack(spacing: 0) {
            HStack(spacing: 18) {
                Text(monthTitle)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(ClastorTheme.ink)
                Spacer()
                if !pageDays.contains(where: { calendar.isDateInToday($0) }) {
                    Button("Today") {
                        withAnimation { pageAnchor = calendar.startOfDay(for: Date()) }
                    }
                    .font(.subheadline.weight(.medium))
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                }
                Button {
                    shift(-1)
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.subheadline.weight(.semibold))
                        .frame(width: 30, height: 30)
                        .background(ClastorTheme.card, in: Circle())
                        .overlay(Circle().strokeBorder(ClastorTheme.border, lineWidth: 1))
                }
                .accessibilityLabel("Previous 3 days")
                Button {
                    shift(1)
                } label: {
                    Image(systemName: "chevron.right")
                        .font(.subheadline.weight(.semibold))
                        .frame(width: 30, height: 30)
                        .background(ClastorTheme.card, in: Circle())
                        .overlay(Circle().strokeBorder(ClastorTheme.border, lineWidth: 1))
                }
                .accessibilityLabel("Next 3 days")
                Button {
                    showCreate = true
                } label: {
                    Image(systemName: "plus")
                        .font(.subheadline.weight(.semibold))
                        .frame(width: 30, height: 30)
                        .background(Color.accentColor, in: Circle())
                        .foregroundStyle(.white)
                }
                .accessibilityIdentifier("calendar.add")
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)
            .padding(.bottom, 12)

            HStack(spacing: 0) {
                Color.clear.frame(width: Self.gutter)
                ForEach(pageDays, id: \.timeIntervalSince1970) { day in
                    dayHeader(day)
                }
            }
            .padding(.bottom, 6)

            Rectangle().fill(ClastorTheme.border).frame(height: 0.5)
        }
        .buttonStyle(.plain)
        .background(ClastorTheme.background)
    }

    private var monthTitle: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_AU_POSIX")
        formatter.dateFormat = "MMMM"
        return formatter.string(from: pageAnchor)
    }

    private func dayHeader(_ day: Date) -> some View {
        let isToday = calendar.isDateInToday(day)
        return VStack(spacing: 4) {
            Text(weekdayLabel(day))
                .font(.caption2.weight(.medium))
                .foregroundStyle(ClastorTheme.mutedInk)
            Text(dayNumber(day))
                .font(.title3.weight(isToday ? .bold : .semibold))
                .foregroundStyle(isToday ? .white : ClastorTheme.ink)
                .frame(width: 34, height: 34)
                .background {
                    if isToday {
                        Circle().fill(Color.accentColor)
                    }
                }
        }
        .frame(maxWidth: .infinity)
        .accessibilityLabel(accessibleDayLabel(day))
    }

    private func shift(_ direction: Int) {
        withAnimation {
            pageAnchor = calendar.date(byAdding: .day, value: direction * 3, to: pageAnchor) ?? pageAnchor
        }
    }

    private func weekdayLabel(_ day: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_AU_POSIX")
        formatter.dateFormat = "EEE"
        return formatter.string(from: day).uppercased()
    }

    private func dayNumber(_ day: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_AU_POSIX")
        formatter.dateFormat = "d"
        return formatter.string(from: day)
    }

    private func accessibleDayLabel(_ day: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_AU_POSIX")
        formatter.dateFormat = "EEEE d MMMM"
        return formatter.string(from: day)
    }

    // MARK: Data

    @MainActor
    private func load(force: Bool = false) async {
        await lessonStore.loadWindow(from: windowStart, to: windowEnd, session, force: force)
    }

    private func lessonsByDay(days: [Date]) -> [Date: [LessonModels.LessonResponse]] {
        var byDay: [Date: [LessonModels.LessonResponse]] = [:]
        for lesson in lessonStore.windowLessons {
            guard !(lesson.isCancelled ?? false),
                  let start = HomeDerivations.date(lesson.startDateTime)
            else { continue }
            let day = calendar.startOfDay(for: start)
            byDay[day, default: []].append(lesson)
        }
        return byDay
    }
}

// MARK: - Pager

/// Infinite horizontal pager: a TabView page style over ±1 pages relative to
/// the anchor; when a swipe settles on an edge page the anchor steps by 3
/// days and selection snaps back to the middle, so the content is endless.
private struct DayPager: View {
    let anchor: Date
    let hourHeight: CGFloat
    let gutter: CGFloat
    let calendar: Calendar
    let lessonsByDay: [Date: [LessonModels.LessonResponse]]
    let studentNames: [String: String]
    let onShift: (Int) -> Void
    let onTapLesson: (LessonModels.LessonResponse) -> Void

    @State private var selection = 0

    var body: some View {
        TabView(selection: $selection) {
            ForEach([-1, 0, 1], id: \.self) { offset in
                TimelinePage(
                    days: pageDays(for: offset),
                    lessonsByDay: lessonsByDay,
                    studentNames: studentNames,
                    hourHeight: hourHeight,
                    gutter: gutter,
                    calendar: calendar,
                    onTapLesson: onTapLesson)
                    .tag(offset)
            }
        }
        .tabViewStyle(.page(indexDisplayMode: .never))
        .onChange(of: selection) { _, newValue in
            if newValue != 0 {
                let direction = newValue
                selection = 0
                onShift(direction)
            }
        }
    }

    private func pageDays(for offset: Int) -> [Date] {
        let start = calendar.date(byAdding: .day, value: offset * 3, to: anchor) ?? anchor
        return (0..<3).compactMap { calendar.date(byAdding: .day, value: $0, to: start) }
    }
}

// MARK: - Timeline page

/// A single 3-day page: shared hour grid down the left gutter, one column
/// per day, event blocks positioned by minutes-from-midnight.
private struct TimelinePage: View {
    let days: [Date]
    let lessonsByDay: [Date: [LessonModels.LessonResponse]]
    let studentNames: [String: String]
    let hourHeight: CGFloat
    let gutter: CGFloat
    let calendar: Calendar
    let onTapLesson: (LessonModels.LessonResponse) -> Void

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                ZStack(alignment: .topLeading) {
                    hourGrid
                    ForEach(days, id: \.timeIntervalSince1970) { day in
                        dayColumn(day)
                            .padding(.leading, gutter + columnIndex(day) * columnWidth)
                    }
                    nowLine
                }
            }
            .task {
                // Open scrolled to the current hour (or a sane morning default).
                let target = min(max(Calendar.current.component(.hour, from: Date()), 8), 22)
                proxy.scrollTo("hour\(target)", anchor: .top)
            }
        }
    }

    private var gridHeight: CGFloat { 24 * hourHeight }

    private func columnIndex(_ day: Date) -> CGFloat {
        CGFloat(days.firstIndex { calendar.isDate($0, inSameDayAs: day) } ?? 0)
    }

    private var columnWidth: CGFloat {
        // ponytail: assumes full-width page; pass real width if pages ever
        // share the screen with side chrome.
        (UIScreen.main.bounds.width - gutter) / 3
    }

    /// Hour labels + hairlines, with scroll anchors for auto-scroll.
    private var hourGrid: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(0...24, id: \.self) { hour in
                HStack(alignment: .top, spacing: 0) {
                    Text(hourLabel(hour))
                        .font(.caption2)
                        .foregroundStyle(ClastorTheme.mutedInk)
                        .frame(width: gutter - 10, alignment: .trailing)
                    Rectangle()
                        .fill(ClastorTheme.border)
                        .frame(height: 0.5)
                        .padding(.leading, 10)
                }
                .frame(height: hourHeight, alignment: .top)
                .id("hour\(hour)")
            }
        }
        .frame(width: UIScreen.main.bounds.width, alignment: .leading)
    }

    private func hourLabel(_ hour: Int) -> String {
        switch hour {
        case 0: return ""
        case 12: return "12 pm"
        case 1...11: return "\(hour) am"
        default: return "\(hour - 12) pm"
        }
    }

    @ViewBuilder private var nowLine: some View {
        if let today = days.first(where: { calendar.isDateInToday($0) }) {
            TimelineView(.periodic(from: .now, by: 60)) { context in
                let minutes = calendar.component(.hour, from: context.date) * 60
                    + calendar.component(.minute, from: context.date)
                HStack(spacing: 0) {
                    Circle().fill(.red).frame(width: 7, height: 7)
                    Rectangle().fill(.red.opacity(0.7)).frame(height: 1.5)
                }
                .padding(.leading, gutter - 10 + columnIndex(today) * columnWidth)
                .frame(width: columnWidth, alignment: .leading)
                .offset(y: CGFloat(minutes) / 60 * hourHeight - 3)
            }
        }
    }

    /// One day's column of positioned event blocks, split side-by-side when
    /// events overlap.
    private func dayColumn(_ day: Date) -> some View {
        let lessons = lessonsByDay[calendar.startOfDay(for: day)] ?? []
        return ZStack(alignment: .topLeading) {
            Color.clear.frame(width: columnWidth, height: gridHeight)
            ForEach(layout(lessons), id: \.lesson.id) { block in
                eventBlock(block)
                    .frame(width: columnWidth / CGFloat(block.groupSize) - 2, height: block.height)
                    .offset(x: CGFloat(block.column) * columnWidth / CGFloat(block.groupSize) + 1,
                            y: block.offset)
            }
        }
        .frame(width: columnWidth, height: gridHeight, alignment: .topLeading)
    }

    /// Greedy overlap layout: cluster lessons that overlap in time, then
    /// spread each cluster across the fewest side-by-side columns.
    // ponytail: greedy column packing, not Apple's optimal 2-column packing;
    // revisit when schedules regularly have 3+ simultaneous lessons.
    private func layout(_ lessons: [LessonModels.LessonResponse]) -> [EventBlock] {
        let sorted = lessons.sorted {
            (HomeDerivations.date($0.startDateTime) ?? .distantPast) <
            (HomeDerivations.date($1.startDateTime) ?? .distantPast)
        }
        var blocks: [EventBlock] = []
        var cluster: [LessonModels.LessonResponse] = []
        var clusterEnd: Date = .distantPast

        func flush() {
            // Assign each overlapping lesson the first column whose last
            // lesson ends before this one starts.
            var columnEnds: [Date] = []
            var assigned: [Int] = []
            for lesson in cluster {
                let start = HomeDerivations.date(lesson.startDateTime) ?? .distantPast
                let end = HomeDerivations.endDate(of: lesson, start: start)
                let column = columnEnds.firstIndex { $0 <= start } ?? columnEnds.count
                if column == columnEnds.count { columnEnds.append(end) } else { columnEnds[column] = end }
                assigned.append(column)
            }
            let groupSize = columnEnds.count
            for (position, lesson) in cluster.enumerated() {
                let start = HomeDerivations.date(lesson.startDateTime) ?? .distantPast
                let end = HomeDerivations.endDate(of: lesson, start: start)
                let minutes = calendar.dateComponents([.minute], from: calendar.startOfDay(for: start), to: start).minute ?? 0
                blocks.append(EventBlock(
                    lesson: lesson,
                    offset: CGFloat(minutes) / 60 * hourHeight,
                    height: max(end.timeIntervalSince(start) / 3600 * hourHeight - 4, 30),
                    column: assigned[position],
                    groupSize: max(groupSize, 1)))
            }
            cluster.removeAll()
            clusterEnd = .distantPast
        }

        for lesson in sorted {
            let start = HomeDerivations.date(lesson.startDateTime) ?? .distantPast
            let end = HomeDerivations.endDate(of: lesson, start: start)
            if start < clusterEnd, !cluster.isEmpty {
                cluster.append(lesson)
                clusterEnd = max(clusterEnd, end)
            } else {
                flush()
                cluster = [lesson]
                clusterEnd = end
            }
        }
        flush()
        return blocks
    }

    private struct EventBlock {
        let lesson: LessonModels.LessonResponse
        let offset: CGFloat
        let height: CGFloat
        let column: Int
        let groupSize: Int
    }

    private func eventBlock(_ block: EventBlock) -> some View {
        let lesson = block.lesson
        let isPast = (HomeDerivations.date(lesson.startDateTime) ?? .distantPast) < Date()
        return Button {
            onTapLesson(lesson)
        } label: {
            VStack(alignment: .leading, spacing: 1) {
                Text(blockTitle(lesson))
                    .font(.caption2.weight(.semibold))
                    .lineLimit(1)
                if block.height > 40 {
                    Text(LessonDerivations.timeRange(for: lesson))
                        .font(.system(size: 9))
                }
            }
            .padding(5)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .clipped()
        }
        .buttonStyle(.plain)
        .background(
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .fill(Color.accentColor.opacity(isPast ? 0.15 : 0.9))
        )
        .foregroundStyle(isPast ? Color.accentColor : .white)
        .accessibilityIdentifier("calendar.event.\(lesson.id)")
    }

    private func blockTitle(_ lesson: LessonModels.LessonResponse) -> String {
        let student = studentNames[lesson.studentId] ?? "Lesson"
        return lesson.subject.map { "\($0) · \(student)" } ?? student
    }
}
