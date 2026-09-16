import Foundation

// Identifiable conformance for generated DTOs used in ForEach lists.
extension LessonModels.LessonTodo: Identifiable {}

// Swift port of shared/src/features/lessons/lesson-utils.ts and the web's
// lesson-display.ts badges, so every mobile lesson surface agrees with web.
enum LessonDerivations {
    // MARK: Cooldowns (backend-mirrored, UI lockout only)

    static let studentNotifyCooldown: TimeInterval = 24 * 60 * 60
    static let invoiceResendCooldown: TimeInterval = 24 * 60 * 60

    /// Compact countdown for a remaining duration: "Xh Ym" / "Xh" / "Ym".
    /// Days fold into hours so a 24h cooldown reads "24h".
    static func formatMsRemaining(_ seconds: TimeInterval) -> String {
        if seconds <= 0 { return "" }
        let totalMinutes = Int(seconds / 60)
        let totalHours = totalMinutes / 60
        let minutes = totalMinutes % 60
        if totalHours > 0 {
            return minutes > 0 ? "\(totalHours)h \(minutes)m" : "\(totalHours)h"
        }
        return "\(minutes)m"
    }

    // MARK: Labels

    static func attendanceLabel(_ status: String) -> String {
        switch status {
        case "unrecorded": return "Unrecorded"
        case "present": return "Present"
        case "present_late": return "Present (late)"
        case "absent_no_makeup": return "Absent — no make-up credit"
        case "absent_makeup_issued": return "Absent — make-up credit issued"
        case "absent_warning": return "Absent — warning issued"
        case "tutor_cancelled": return "Tutor cancelled"
        case "tutor_cancelled_makeup_issued": return "Tutor cancelled — make-up credit issued"
        default: return status
        }
    }

    static let attendanceOptions: [String] = [
        "unrecorded", "present", "present_late", "absent_no_makeup",
        "absent_makeup_issued", "absent_warning", "tutor_cancelled",
        "tutor_cancelled_makeup_issued",
    ]

    static func acceptanceLabel(_ status: String) -> String {
        switch status {
        case "pending": return "Pending"
        case "accepted": return "Accepted"
        case "declined": return "Declined"
        default: return status
        }
    }

    // MARK: Status derivation

    /// scheduled | completed | cancelled, from isCancelled + attendance.
    static func derivedStatus(_ lesson: LessonModels.LessonResponse) -> String {
        if lesson.isCancelled ?? false { return "cancelled" }
        switch lesson.attendanceStatus {
        case "tutor_cancelled", "tutor_cancelled_makeup_issued": return "cancelled"
        case "unrecorded": return "scheduled"
        default: return "completed"
        }
    }

    static func date(_ iso: String) -> Date? {
        HomeDerivations.date(iso)
    }

    static func endDate(of lesson: LessonModels.LessonResponse) -> Date? {
        date(lesson.startDateTime).map { $0.addingTimeInterval(TimeInterval(lesson.durationMinutes) * 60) }
    }

    static func isUpcoming(_ lesson: LessonModels.LessonResponse, now: Date = .init()) -> Bool {
        guard let start = date(lesson.startDateTime) else { return false }
        return start >= now
    }

    /// True when the lesson can no longer be managed: attendance recorded or
    /// the end time has passed.
    static func isFinished(_ lesson: LessonModels.LessonResponse, now: Date = .init()) -> Bool {
        if lesson.attendanceStatus != "unrecorded" { return true }
        guard let end = endDate(of: lesson) else { return false }
        return end < now
    }

    // MARK: Badge (mirrors web lessonBadge / lessonStatusBadge)

    enum BadgeTone { case sky, amber, emerald, rose, muted }

    struct Badge: Equatable {
        var label: String
        var tone: BadgeTone
    }

    static func lessonBadge(_ lesson: LessonModels.LessonResponse, now: Date = .init()) -> Badge {
        let status = derivedStatus(lesson)
        if status == "cancelled" {
            return Badge(label: "Cancelled", tone: .muted)
        }
        if isUpcoming(lesson, now: now) {
            return Badge(label: "Upcoming", tone: .sky)
        }
        switch lesson.attendanceStatus {
        case "unrecorded": return Badge(label: "Not recorded", tone: .amber)
        case "present": return Badge(label: "Present", tone: .emerald)
        case "present_late": return Badge(label: "Late", tone: .amber)
        case "absent_no_makeup": return Badge(label: "Absent", tone: .rose)
        case "absent_makeup_issued": return Badge(label: "Absent — credited", tone: .amber)
        case "absent_warning": return Badge(label: "Absent — warned", tone: .rose)
        default: return Badge(label: attendanceLabel(lesson.attendanceStatus), tone: .muted)
        }
    }

    /// App-wide badge: upcoming lessons surface acceptance instead —
    /// Pending/Declined, nothing when accepted. Past lessons show attendance.
    static func lessonStatusBadge(_ lesson: LessonModels.LessonResponse, now: Date = .init()) -> Badge? {
        let base = lessonBadge(lesson, now: now)
        if base.label == "Upcoming" {
            if lesson.acceptanceStatus == "pending" { return Badge(label: "Pending", tone: .amber) }
            if lesson.acceptanceStatus == "declined" { return Badge(label: "Declined", tone: .rose) }
            return nil
        }
        return base
    }

    // MARK: Date/time formatters (date-fns formats from lesson-utils.ts)

    /// "Mon, 5 Jan"
    static func formatLessonDate(_ date: Date) -> String {
        formatted(date, "EEE, d MMM")
    }

    /// "5:30 PM"
    static func formatLessonTime(_ date: Date) -> String {
        formatted(date, "h:mm a")
    }

    /// "Mon, 5 Jan, 4:30 PM"
    static func formatLessonDateTime(_ date: Date) -> String {
        formatted(date, "EEE, d MMM, h:mm a")
    }

    /// "09:00 – 10:30" (24h, matching HomeDerivations.lessonTimeRange).
    static func timeRange(for lesson: LessonModels.LessonResponse, timeZone: TimeZone = .current) -> String {
        HomeDerivations.lessonTimeRange(lesson, timeZone: timeZone)
    }

    private static func formatted(_ date: Date, _ format: String, timeZone: TimeZone = .current) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = format
        formatter.timeZone = timeZone
        return formatter.string(from: date)
    }
}
