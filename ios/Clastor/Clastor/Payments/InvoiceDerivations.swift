import Foundation

// Swift port of shared/src/features/payments/invoice-utils.ts and
// invoice-config.ts. Totals math mirrors the backend's computeTotals exactly
// so the client-displayed total always equals the persisted one.
enum InvoiceDerivations {
    static let defaultDueDays = 14

    static func defaultDueDate(now: Date = .init()) -> Date {
        now.addingTimeInterval(TimeInterval(defaultDueDays) * 86_400)
    }

    // MARK: Labels

    static func statusLabel(_ status: String) -> String {
        switch status {
        case "draft": return "Draft"
        case "open": return "Open"
        case "paid": return "Paid"
        case "overdue": return "Overdue"
        case "void": return "Void"
        default: return status
        }
    }

    static func paymentMethodLabel(_ method: String) -> String {
        switch method {
        case "cash": return "Cash"
        case "bank_transfer": return "Bank Transfer"
        case "stripe": return "Stripe"
        default: return method
        }
    }

    // MARK: Currency (en-AU, mirroring Intl formatters)

    /// 2-decimal currency, e.g. "$1,234.50" (formatCurrency).
    static func formatCurrency(_ amount: Double, currency: String = "AUD") -> String {
        currencyFormatter(currency: currency).string(from: NSNumber(value: amount)) ?? String(format: "%.2f", amount)
    }

    /// Drops a trailing ".00" for whole amounts (formatCompactCurrency).
    static func formatCompactCurrency(_ amount: Double, currency: String = "AUD") -> String {
        let text = formatCurrency(amount, currency: currency)
        return text.hasSuffix(".00") ? String(text.dropLast(3)) : text
    }

    private static func currencyFormatter(currency: String) -> NumberFormatter {
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: "en_AU")
        formatter.numberStyle = .currency
        formatter.currencyCode = currency
        formatter.minimumFractionDigits = 2
        formatter.maximumFractionDigits = 2
        return formatter
    }

    // MARK: Dates

    /// Timestamps exactly at UTC midnight are date-only values (dueDate is
    /// built from YYYY-MM-DD) — render the stored calendar day, not the
    /// local-time instant.
    static func isDateOnlyUTC(_ iso: String) -> Bool {
        // ^\d{4}-\d{2}-\d{2}T00:00:00(\.000)?Z$
        let pattern = "^\\d{4}-\\d{2}-\\d{2}T00:00:00(?:\\.000)?Z$"
        return iso.range(of: pattern, options: .regularExpression) != nil
    }

    /// "20 Jun 2026" (formatDate), honouring the date-only-UTC rule.
    static func formatDate(_ iso: String) -> String {
        guard let date = HomeDerivations.date(iso) else { return iso }
        if isDateOnlyUTC(iso) {
            return formatted(date, "d MMM yyyy", timeZone: TimeZone(identifier: "UTC")!)
        }
        return formatted(date, "d MMM yyyy", timeZone: .current)
    }

    /// "20 Jun 2026, 4:30 PM" (formatDateTime) — always the local instant.
    static func formatDateTime(_ iso: String) -> String {
        guard let date = HomeDerivations.date(iso) else { return iso }
        return formatted(date, "d MMM yyyy, h:mm a", timeZone: .current)
    }

    /// "20 Jun 2026, 4:30 PM" for a plain Date.
    static func formatDateTime(_ date: Date) -> String {
        formatted(date, "d MMM yyyy, h:mm a", timeZone: .current)
    }

    private static func formatted(_ date: Date, _ format: String, timeZone: TimeZone) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = format
        formatter.timeZone = timeZone
        return formatter.string(from: date)
    }

    // MARK: Overdue

    static func isOverdue(_ invoice: PaymentModels.InvoiceResponse, now: Date = .init()) -> Bool {
        guard invoice.status == "open" || invoice.status == "overdue",
              let due = HomeDerivations.date(invoice.dueDate)
        else { return false }
        return due < now
    }

    // MARK: Lesson eligibility (partitionInvoiceableLessons)

    static func isCancelledLesson(_ lesson: LessonModels.LessonResponse) -> Bool {
        if lesson.isCancelled ?? false { return true }
        return lesson.attendanceStatus == "tutor_cancelled"
            || lesson.attendanceStatus == "tutor_cancelled_makeup_issued"
    }

    static func isExcludedFromInvoicing(_ lesson: LessonModels.LessonResponse) -> Bool {
        switch lesson.attendanceStatus {
        case "absent_makeup_issued", "absent_warning",
             "tutor_cancelled", "tutor_cancelled_makeup_issued":
            return true
        default:
            return false
        }
    }

    /// Attended, or absent without make-up credit (still pays).
    static func isChargeableAttendance(_ lesson: LessonModels.LessonResponse) -> Bool {
        switch lesson.attendanceStatus {
        case "present", "present_late", "absent_no_makeup":
            return true
        default:
            return false
        }
    }

    struct InvoiceablePartitions {
        var upcoming: [LessonModels.LessonResponse]
        var chargeable: [LessonModels.LessonResponse]
        var unrecorded: [LessonModels.LessonResponse]
    }

    /// Split unpaid lessons into upcoming / completed-chargeable /
    /// completed-unrecorded, with the web's sort orders
    /// (completed newest-first, upcoming soonest-first).
    static func partitionInvoiceableLessons(
        _ lessons: [LessonModels.LessonResponse], now: Date = .init()
    ) -> InvoiceablePartitions {
        var upcoming: [(LessonModels.LessonResponse, Date)] = []
        var chargeable: [(LessonModels.LessonResponse, Date)] = []
        var unrecorded: [(LessonModels.LessonResponse, Date)] = []
        for lesson in lessons {
            guard !isCancelledLesson(lesson), !isExcludedFromInvoicing(lesson),
                  let start = date(lesson.startDateTime)
            else { continue }
            if start >= now {
                upcoming.append((lesson, start))
            } else if isChargeableAttendance(lesson) {
                chargeable.append((lesson, start))
            } else if lesson.attendanceStatus == "unrecorded" {
                unrecorded.append((lesson, start))
            }
        }
        return InvoiceablePartitions(
            upcoming: upcoming.sorted { $0.1 < $1.1 }.map(\.0),
            chargeable: chargeable.sorted { $0.1 > $1.1 }.map(\.0),
            unrecorded: unrecorded.sorted { $0.1 > $1.1 }.map(\.0)
        )
    }

    private static func date(_ iso: String) -> Date? {
        HomeDerivations.date(iso)
    }

    // MARK: Line items

    /// Hours for hourly (2dp), 1 for per_lesson.
    static func defaultQuantity(rateType: String, durationMinutes: Int) -> Double {
        if rateType == "hourly" {
            return ((Double(durationMinutes) / 60) * 100).rounded() / 100
        }
        return 1
    }

    /// "{subject or 'Lesson'} — {duration} min on {date}".
    static func buildLessonDescription(_ lesson: LessonModels.LessonResponse) -> String {
        "\(lesson.subject ?? "Lesson") — \(lesson.durationMinutes) min on \(formatDate(lesson.startDateTime))"
    }

    static func buildLessonLineItem(
        _ lesson: LessonModels.LessonResponse, rateType: String, expectedAmount: Double
    ) -> CreateInvoiceLineItemBody {
        CreateInvoiceLineItemBody(
            lessonId: lesson.id,
            description: buildLessonDescription(lesson),
            durationMinutes: lesson.durationMinutes,
            rateType: rateType,
            unitAmount: expectedAmount,
            quantity: defaultQuantity(rateType: rateType, durationMinutes: lesson.durationMinutes)
        )
    }

    // MARK: Totals (backend parity)

    /// Each line rounded individually to 2dp.
    static func roundLineAmount(unitAmount: Double, quantity: Double) -> Double {
        (unitAmount * quantity * 100).rounded() / 100
    }

    /// Sum of rounded lines, re-rounded to 2dp. total === subtotal.
    static func lineItemsSubtotal(_ items: [CreateInvoiceLineItemBody]) -> Double {
        let sum = items.reduce(0.0) { $0 + roundLineAmount(unitAmount: $1.unitAmount, quantity: $1.quantity) }
        return (sum * 100).rounded() / 100
    }
}
