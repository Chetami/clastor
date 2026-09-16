import Foundation

// Identifiable conformance for generated DTOs used in ForEach lists.
extension StudentModels.StudentResponse: Identifiable {}
extension PaymentModels.InvoiceResponse: Identifiable {}
extension PaymentModels.InvoiceEventResponse: Identifiable {}
extension LessonModels.LessonResponse: Identifiable {}

// Swift port of shared/src/features/students/student-utils.ts and
// student-stats.ts.
enum StudentDerivations {
    // MARK: Labels

    static func rateTypeLabel(_ rateType: String) -> String {
        rateType == "hourly" ? "Hourly" : "Per Lesson"
    }

    static func statusLabel(_ status: String) -> String {
        status == "active" ? "Active" : "Past"
    }

    static func rateUnit(_ rateType: String) -> String {
        rateType == "hourly" ? "/hr" : "/lesson"
    }

    /// "$45/hr" / "$40/lesson".
    static func formatRate(_ amount: Double, rateType: String, currency: String = "AUD") -> String {
        InvoiceDerivations.formatCompactCurrency(amount, currency: currency) + rateUnit(rateType)
    }

    /// "4 hrs/wk" / "2/wk".
    static func formatFrequency(_ frequency: Int, rateType: String) -> String {
        rateType == "hourly" ? "\(frequency) hrs/wk" : "\(frequency)/wk"
    }

    /// "Jane Doe" → "JD".
    static func initials(_ name: String) -> String {
        let parts = name.split(separator: " ").compactMap(\.first)
        guard !parts.isEmpty else { return "?" }
        return String(parts.prefix(2).map(String.init).joined())
    }

    // MARK: Billing email resolution (mirrors the backend's read-time logic)

    /// Explicit override wins, then parent email, then the student's email.
    static func resolveBillingEmail(
        explicit: String?, parentEmail: String?, email: String?
    ) -> String? {
        if let explicit, !explicit.trimmingCharacters(in: .whitespaces).isEmpty { return explicit }
        if let parentEmail, !parentEmail.trimmingCharacters(in: .whitespaces).isEmpty { return parentEmail }
        if let email, !email.trimmingCharacters(in: .whitespaces).isEmpty { return email }
        return nil
    }

    /// "explicit" | "parent" | "student".
    static func resolveBillingEmailSource(explicit: String?, parentEmail: String?) -> String {
        if let explicit, !explicit.trimmingCharacters(in: .whitespaces).isEmpty { return "explicit" }
        if let parentEmail, !parentEmail.trimmingCharacters(in: .whitespaces).isEmpty { return "parent" }
        return "student"
    }

    static func billingEmailSourceLabel(_ source: String) -> String {
        switch source {
        case "explicit": return "Custom"
        case "parent": return "Parent email"
        case "student": return "Student email"
        default: return source
        }
    }

    // MARK: Stats (computeStudentStats, six-month window by default)

    struct Stats: Equatable {
        var total = 0
        var attended = 0
        var late = 0
        var noShows = 0
        var tutorCancels = 0
        var declined = 0
        var upcoming = 0
        var disruptions = 0
        var attendedRate: Double?
        var noShowRate: Double?
        var disruptionRate: Double?
        /// Missed > 20% of resolved lessons over ≥ 3.
        var warning = false
    }

    /// UTC-anchored window for a stats period ("month", "six_months", "year").
    static func statsWindow(period: String, now: Date = .init()) -> (start: Date, end: Date) {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        let components = calendar.dateComponents([.year, .month], from: now)
        let startOfYear = calendar.date(from: DateComponents(year: components.year, month: 1, day: 1))!
        switch period {
        case "month":
            let start = calendar.date(from: components)!
            return (start, calendar.date(byAdding: .month, value: 1, to: start)!)
        case "six_months":
            let start = calendar.date(byAdding: .month, value: -5, to: calendar.date(from: components)!)!
            return (start, calendar.date(byAdding: .month, value: 1, to: calendar.date(from: components)!)!)
        default:
            return (startOfYear, calendar.date(byAdding: .year, value: 1, to: startOfYear)!)
        }
    }

    /// Roll one student's lessons up into outcome buckets. Priority order:
    /// tutorCancels > noShows > declined > attended > upcoming.
    static func computeStats(
        _ lessons: [LessonModels.LessonResponse], period: String = "six_months", now: Date = .init()
    ) -> Stats {
        let window = statsWindow(period: period, now: now)
        var stats = Stats()
        for lesson in lessons {
            guard let start = HomeDerivations.date(lesson.startDateTime),
                  start >= window.start, start < window.end
            else { continue }
            stats.total += 1
            switch outcome(of: lesson) {
            case .tutorCancels: stats.tutorCancels += 1
            case .noShows: stats.noShows += 1
            case .declined: stats.declined += 1
            case .attended:
                stats.attended += 1
                if lesson.attendanceStatus == "present_late" { stats.late += 1 }
            case .upcoming: stats.upcoming += 1
            }
        }
        stats.disruptions = stats.noShows + stats.tutorCancels + stats.declined
        let resolved = stats.attended + stats.noShows
        stats.attendedRate = resolved > 0 ? Double(stats.attended) / Double(resolved) : nil
        stats.noShowRate = resolved > 0 ? Double(stats.noShows) / Double(resolved) : nil
        stats.disruptionRate = stats.total > 0 ? Double(stats.disruptions) / Double(stats.total) : nil
        stats.warning = (stats.noShowRate ?? 0) > 0.2 && resolved >= 3
        return stats
    }

    private enum Outcome { case attended, noShows, tutorCancels, declined, upcoming }

    private static func outcome(of lesson: LessonModels.LessonResponse) -> Outcome {
        if lesson.isCancelled ?? false { return .tutorCancels }
        switch lesson.attendanceStatus {
        case "tutor_cancelled", "tutor_cancelled_makeup_issued":
            return .tutorCancels
        case "absent_no_makeup", "absent_makeup_issued", "absent_warning":
            return .noShows
        default:
            break
        }
        if lesson.acceptanceStatus == "declined" { return .declined }
        if lesson.attendanceStatus == "present" || lesson.attendanceStatus == "present_late" {
            return .attended
        }
        return .upcoming
    }
}
