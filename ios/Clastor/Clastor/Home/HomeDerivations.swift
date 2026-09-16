import Foundation

// Swift port of the tutor dashboard derivations in
// shared/src/features/dashboard/lib.ts. Behaviour mirrors the web client so
// both surfaces agree on "current", "next" and "todo".
enum HomeDerivations {
    private static let fractionalISO: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    static func date(_ isoString: String) -> Date? {
        fractionalISO.date(from: isoString) ?? ISO8601DateFormatter().date(from: isoString)
    }

    static func endDate(of lesson: HomeModels.LessonResponse, start: Date) -> Date {
        start.addingTimeInterval(TimeInterval(lesson.durationMinutes) * 60)
    }

    static func isLive(_ lesson: HomeModels.LessonResponse, now: Date) -> Bool {
        guard !(lesson.isCancelled ?? false), let start = date(lesson.startDateTime) else { return false }
        return now >= start && now <= endDate(of: lesson, start: start)
    }

    static func findCurrentLesson(
        _ lessons: [HomeModels.LessonResponse], now: Date = .init()
    ) -> HomeModels.LessonResponse? {
        lessons.first { isLive($0, now: now) }
    }

    static func nextLesson(
        _ lessons: [HomeModels.LessonResponse], now: Date = .init()
    ) -> HomeModels.LessonResponse? {
        upcoming(lessons, now: now).first
    }

    /// Future non-cancelled lessons, sorted ascending. Mirrors the web's
    /// upcomingLessons: an in-progress lesson already started, so it is not
    /// "upcoming" — the dashboard shows it as the current lesson instead.
    static func upcoming(
        _ lessons: [HomeModels.LessonResponse], now: Date
    ) -> [HomeModels.LessonResponse] {
        lessons
            .compactMap { lesson -> (HomeModels.LessonResponse, Date)? in
                guard !(lesson.isCancelled ?? false),
                      let start = date(lesson.startDateTime),
                      start >= now
                else { return nil }
                return (lesson, start)
            }
            .sorted { $0.1 < $1.1 }
            .map(\.0)
    }

    /// Past, non-cancelled lessons whose attendance is still unrecorded,
    /// most-recent first so freshly-finished lessons surface.
    static func todoLessons(
        _ lessons: [HomeModels.LessonResponse], now: Date = .init()
    ) -> [HomeModels.LessonResponse] {
        lessons
            .compactMap { lesson -> (HomeModels.LessonResponse, Date)? in
                guard !(lesson.isCancelled ?? false),
                      lesson.attendanceStatus == "unrecorded",
                      let start = date(lesson.startDateTime),
                      start < now
                else { return nil }
                return (lesson, start)
            }
            .sorted { $0.1 > $1.1 }
            .map(\.0)
    }

    /// Compact countdown: "in 45 min", "in 3h 15m", "in 2d 5h", "Now",
    /// "Started" — matching the web strings.
    static func timeUntil(_ start: Date, now: Date = .init()) -> String {
        let seconds = start.timeIntervalSince(now)
        if seconds <= 0 { return "Started" }
        let minutes = Int(seconds / 60)
        if minutes < 1 { return "Now" }
        if minutes < 60 { return "in \(minutes) min" }
        let hours = minutes / 60
        let remainingMinutes = minutes % 60
        if hours < 24 {
            return remainingMinutes > 0 ? "in \(hours)h \(remainingMinutes)m" : "in \(hours)h"
        }
        let days = hours / 24
        let remainingHours = hours % 24
        return remainingHours > 0 ? "in \(days)d \(remainingHours)h" : "in \(days)d"
    }

    /// "Today", "Tomorrow" or "Mon 24 Mar", evaluated in the given calendar.
    static func relativeDayLabel(_ date: Date, calendar: Calendar = .current) -> String {
        if calendar.isDateInToday(date) { return "Today" }
        if calendar.isDateInTomorrow(date) { return "Tomorrow" }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_AU_POSIX")
        formatter.dateFormat = "EEE d MMM"
        return formatter.string(from: date)
    }

    /// "09:00 – 10:00" style range in the given (defaults to local) timezone.
    static func lessonTimeRange(
        _ lesson: HomeModels.LessonResponse, timeZone: TimeZone = .current
    ) -> String {
        guard let start = date(lesson.startDateTime) else { return "" }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_AU_POSIX")
        formatter.dateFormat = "HH:mm"
        formatter.timeZone = timeZone
        return "\(formatter.string(from: start)) – \(formatter.string(from: endDate(of: lesson, start: start)))"
    }

    /// Whole-number currency for stat tiles (mirrors formatCurrencyWhole).
    static func formatCurrencyWhole(_ amount: Double, currency: String = "AUD") -> String {
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: "en_AU")
        formatter.numberStyle = .currency
        formatter.currencyCode = currency
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: amount)) ?? String(Int(amount))
    }

    /// Hours with one decimal place, trimmed of trailing .0.
    static func formatHours(_ hours: Double) -> String {
        var text = String(format: "%.1f", hours)
        if text.hasSuffix(".0") { text.removeLast(2) }
        return text + "h"
    }

    /// Percentage change, nil when both are zero, +100 for new activity.
    static func deltaPercent(current: Double, previous: Double) -> Double? {
        if previous == 0 { return current > 0 ? 100 : nil }
        return (current - previous) / previous * 100
    }

    /// Label for the immediately preceding period (sub-lines on stat tiles).
    static func previousPeriodLabel(_ period: String) -> String {
        switch period {
        case "week": return "Last week"
        case "month": return "Last month"
        case "six_months": return "Prev 6 months"
        default: return "Last year"
        }
    }
}
