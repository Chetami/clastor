import Foundation
import Testing
@testable import Clastor

@MainActor
struct LessonDerivationsTests {
    private func lesson(
        id: String,
        minutesFromNow: Double,
        durationMinutes: Int = 60,
        attendanceStatus: String = "unrecorded",
        acceptanceStatus: String = "pending",
        cancelled: Bool = false,
        seriesID: String? = nil
    ) -> LessonModels.LessonResponse {
        LessonModels.LessonResponse(
            id: id,
            studentId: "student",
            startDateTime: ISO8601DateFormatter().string(from: Date().addingTimeInterval(minutesFromNow * 60)),
            durationMinutes: durationMinutes,
            acceptanceStatus: acceptanceStatus,
            attendanceStatus: attendanceStatus,
            seriesId: seriesID,
            isCancelled: cancelled,
            remindersEnabled: true,
            isPaid: false,
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z"
        )
    }

    @Test func badgesMatchWebLabels() {
        let now = Date()
        #expect(LessonDerivations.lessonBadge(lesson(id: "upcoming", minutesFromNow: 60), now: now).label == "Upcoming")
        #expect(LessonDerivations.lessonBadge(lesson(id: "past", minutesFromNow: -120), now: now).label == "Not recorded")
        #expect(LessonDerivations.lessonBadge(lesson(id: "present", minutesFromNow: -120, attendanceStatus: "present"), now: now).label == "Present")
        #expect(LessonDerivations.lessonBadge(lesson(id: "late", minutesFromNow: -120, attendanceStatus: "present_late"), now: now).label == "Late")
        #expect(LessonDerivations.lessonBadge(lesson(id: "absent", minutesFromNow: -120, attendanceStatus: "absent_no_makeup"), now: now).label == "Absent")
        #expect(LessonDerivations.lessonBadge(lesson(id: "cancelled", minutesFromNow: 60, cancelled: true), now: now).label == "Cancelled")
    }

    @Test func statusBadgeSurfacesAcceptanceForUpcoming() {
        let now = Date()
        #expect(LessonDerivations.lessonStatusBadge(lesson(id: "pending", minutesFromNow: 60), now: now)?.label == "Pending")
        #expect(LessonDerivations.lessonStatusBadge(lesson(id: "declined", minutesFromNow: 60, acceptanceStatus: "declined"), now: now)?.label == "Declined")
        #expect(LessonDerivations.lessonStatusBadge(lesson(id: "accepted", minutesFromNow: 60, acceptanceStatus: "accepted"), now: now) == nil)
    }

    @Test func finishedLessonsCannotBeManaged() {
        let now = Date()
        #expect(LessonDerivations.isFinished(lesson(id: "recorded", minutesFromNow: 30, attendanceStatus: "present"), now: now))
        #expect(LessonDerivations.isFinished(lesson(id: "ended", minutesFromNow: -120), now: now))
        #expect(!LessonDerivations.isFinished(lesson(id: "live", minutesFromNow: -10), now: now))
        #expect(!LessonDerivations.isFinished(lesson(id: "future", minutesFromNow: 60), now: now))
    }

    @Test func cooldownFormattingFoldsDaysIntoHours() {
        #expect(LessonDerivations.formatMsRemaining(-1) == "")
        #expect(LessonDerivations.formatMsRemaining(30 * 60) == "30m")
        #expect(LessonDerivations.formatMsRemaining(23 * 3600 + 59 * 60) == "23h 59m")
        #expect(LessonDerivations.formatMsRemaining(24 * 3600) == "24h")
    }

    @Test func timeFormattingMatchesDateFnsPatterns() {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Australia/Sydney")!
        let date = calendar.date(from: DateComponents(year: 2026, month: 6, day: 20, hour: 15, minute: 5))!
        #expect(LessonDerivations.formatLessonDate(date) == "Sat, 20 Jun")
        #expect(LessonDerivations.formatLessonTime(date) == "3:05 PM")
        #expect(LessonDerivations.formatLessonDateTime(date) == "Sat, 20 Jun, 3:05 PM")
    }
}

@MainActor
struct InvoiceDerivationsTests {
    private func lesson(
        id: String,
        minutesFromNow: Double,
        durationMinutes: Int = 60,
        attendanceStatus: String = "present",
        cancelled: Bool = false,
        paid: Bool = false,
        invoiceID: String? = nil,
        startISO: String? = nil
    ) -> LessonModels.LessonResponse {
        LessonModels.LessonResponse(
            id: id,
            studentId: "student",
            subject: "Mathematics",
            startDateTime: startISO ?? ISO8601DateFormatter().string(from: Date().addingTimeInterval(minutesFromNow * 60)),
            durationMinutes: durationMinutes,
            acceptanceStatus: "accepted",
            attendanceStatus: attendanceStatus,
            isCancelled: cancelled,
            remindersEnabled: true,
            isPaid: paid,
            invoiceId: invoiceID,
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z"
        )
    }

    @Test func partitionSortsAndFiltersLikeTheWeb() {
        let now = Date()
        let lessons = [
            lesson(id: "older-chargeable", minutesFromNow: -3000),
            lesson(id: "newer-chargeable", minutesFromNow: -100),
            lesson(id: "unrecorded", minutesFromNow: -200, attendanceStatus: "unrecorded"),
            lesson(id: "upcoming", minutesFromNow: 200, attendanceStatus: "unrecorded"),
            lesson(id: "excluded", minutesFromNow: -400, attendanceStatus: "absent_makeup_issued"),
            lesson(id: "cancelled", minutesFromNow: -500, cancelled: true),
        ]
        let partitions = InvoiceDerivations.partitionInvoiceableLessons(lessons, now: now)
        #expect(partitions.chargeable.map(\.id) == ["newer-chargeable", "older-chargeable"])
        #expect(partitions.unrecorded.map(\.id) == ["unrecorded"])
        #expect(partitions.upcoming.map(\.id) == ["upcoming"])
    }

    @Test func absentWithoutMakeupIsStillChargeable() {
        let past = lesson(id: "absent-nm", minutesFromNow: -100, attendanceStatus: "absent_no_makeup")
        #expect(InvoiceDerivations.isChargeableAttendance(past))
        let excluded = lesson(id: "absent-mk", minutesFromNow: -100, attendanceStatus: "absent_makeup_issued")
        #expect(!InvoiceDerivations.isChargeableAttendance(excluded))
        #expect(InvoiceDerivations.isExcludedFromInvoicing(excluded))
    }

    @Test func lineItemMathMatchesBackendRounding() {
        #expect(InvoiceDerivations.defaultQuantity(rateType: "hourly", durationMinutes: 90) == 1.5)
        #expect(InvoiceDerivations.defaultQuantity(rateType: "hourly", durationMinutes: 45) == 0.75)
        #expect(InvoiceDerivations.defaultQuantity(rateType: "per_lesson", durationMinutes: 90) == 1)
        #expect(InvoiceDerivations.roundLineAmount(unitAmount: 45, quantity: 1.1) == 49.5)
        #expect(InvoiceDerivations.roundLineAmount(unitAmount: 0.1, quantity: 0.2) == 0.02)
        let items = [
            InvoiceDerivations.buildLessonLineItem(lesson(id: "one", minutesFromNow: -100, durationMinutes: 60), rateType: "hourly", expectedAmount: 60),
            InvoiceDerivations.buildLessonLineItem(lesson(id: "two", minutesFromNow: -200, durationMinutes: 90), rateType: "hourly", expectedAmount: 60),
        ]
        #expect(InvoiceDerivations.lineItemsSubtotal(items) == 150)
    }

    @Test func descriptionUsesSubjectDurationAndDate() {
        let fixture = lesson(id: "desc", minutesFromNow: 0, startISO: "2026-06-20T00:00:00.000Z")
        #expect(InvoiceDerivations.buildLessonDescription(fixture) == "Mathematics — 60 min on 20 Jun 2026")
    }

    @Test func dateOnlyUTCTimestampsRenderTheStoredDay() {
        // UTC-midnight due dates must not shift with the local timezone.
        #expect(InvoiceDerivations.isDateOnlyUTC("2026-06-20T00:00:00.000Z"))
        #expect(InvoiceDerivations.isDateOnlyUTC("2026-06-20T00:00:00Z"))
        #expect(!InvoiceDerivations.isDateOnlyUTC("2026-06-20T12:00:00.000Z"))
        #expect(InvoiceDerivations.formatDate("2026-06-20T00:00:00.000Z") == "20 Jun 2026")
    }

    @Test func compactCurrencyDropsTrailingZeroes() {
        #expect(InvoiceDerivations.formatCompactCurrency(1240, currency: "AUD") == "$1,240")
        #expect(InvoiceDerivations.formatCurrency(1240.5, currency: "AUD") == "$1,240.50")
        #expect(InvoiceDerivations.formatCompactCurrency(1240.5, currency: "AUD") == "$1,240.50")
    }
}

@MainActor
struct StudentDerivationsTests {
    private func lesson(
        minutesFromNow: Double,
        attendanceStatus: String = "unrecorded",
        acceptanceStatus: String = "accepted",
        cancelled: Bool = false
    ) -> LessonModels.LessonResponse {
        LessonModels.LessonResponse(
            id: "lesson-\(UUID().uuidString.prefix(6))",
            studentId: "student",
            subject: nil,
            startDateTime: ISO8601DateFormatter().string(from: Date().addingTimeInterval(minutesFromNow * 60)),
            durationMinutes: 60,
            acceptanceStatus: acceptanceStatus,
            attendanceStatus: attendanceStatus,
            isCancelled: cancelled,
            remindersEnabled: true,
            isPaid: false,
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z"
        )
    }

    @Test func statsBucketPriorityMatchesWeb() {
        let lessons = [
            lesson(minutesFromNow: -2000, attendanceStatus: "present"),
            lesson(minutesFromNow: -1500, attendanceStatus: "present_late"),
            lesson(minutesFromNow: -1000, attendanceStatus: "absent_no_makeup"),
            lesson(minutesFromNow: -500, cancelled: true),
            lesson(minutesFromNow: -300, attendanceStatus: "unrecorded", acceptanceStatus: "declined"),
            lesson(minutesFromNow: 500),
        ]
        let stats = StudentDerivations.computeStats(lessons)
        #expect(stats.total == 6)
        #expect(stats.attended == 2)
        #expect(stats.late == 1)
        #expect(stats.noShows == 1)
        #expect(stats.tutorCancels == 1)
        #expect(stats.declined == 1)
        #expect(stats.upcoming == 1)
        #expect(stats.disruptions == 3)
    }

    @Test func warningFlagsUnreliableStudents() {
        // 2 attended, 1 no-show over 3 resolved → 33% no-show, no warning needs > 20% AND >= 3 resolved.
        let lessons = [
            lesson(minutesFromNow: -2000, attendanceStatus: "present"),
            lesson(minutesFromNow: -1500, attendanceStatus: "present"),
            lesson(minutesFromNow: -1000, attendanceStatus: "absent_no_makeup"),
        ]
        let stats = StudentDerivations.computeStats(lessons)
        #expect(stats.noShowRate! > 0.2)
        #expect(stats.warning)
    }

    @Test func billingEmailResolutionOrder() {
        #expect(StudentDerivations.resolveBillingEmail(explicit: "custom@x.test", parentEmail: "parent@x.test", email: "student@x.test") == "custom@x.test")
        #expect(StudentDerivations.resolveBillingEmail(explicit: nil, parentEmail: "parent@x.test", email: "student@x.test") == "parent@x.test")
        #expect(StudentDerivations.resolveBillingEmail(explicit: "  ", parentEmail: nil, email: "student@x.test") == "student@x.test")
        #expect(StudentDerivations.resolveBillingEmail(explicit: nil, parentEmail: nil, email: nil) == nil)
        #expect(StudentDerivations.resolveBillingEmailSource(explicit: nil, parentEmail: "p@x.test") == "parent")
        #expect(StudentDerivations.billingEmailSourceLabel("explicit") == "Custom")
    }

    @Test func initialsAndFormatting() {
        #expect(StudentDerivations.initials("Jane Doe") == "JD")
        #expect(StudentDerivations.initials("Cher") == "C")
        #expect(StudentDerivations.formatFrequency(4, rateType: "hourly") == "4 hrs/wk")
        #expect(StudentDerivations.formatFrequency(2, rateType: "per_lesson") == "2/wk")
        #expect(StudentDerivations.formatRate(45, rateType: "hourly") == "$45/hr")
        #expect(StudentDerivations.formatRate(40, rateType: "per_lesson") == "$40/lesson")
    }
}
