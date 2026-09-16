import Foundation
import Testing
@testable import Clastor

@MainActor
struct HomeDerivationsTests {
    private func lesson(
        id: String,
        minutesFromNow: Double,
        durationMinutes: Int = 60,
        attendanceStatus: String = "unrecorded",
        cancelled: Bool = false
    ) -> HomeModels.LessonResponse {
        HomeModels.LessonResponse(
            id: id,
            studentId: "student",
            startDateTime: ISO8601DateFormatter().string(from: Date().addingTimeInterval(minutesFromNow * 60)),
            durationMinutes: durationMinutes,
            acceptanceStatus: "accepted",
            attendanceStatus: attendanceStatus,
            isCancelled: cancelled,
            remindersEnabled: true,
            isPaid: false,
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z"
        )
    }

    @Test func currentLessonIsTheOneHappeningNow() {
        let now = Date()
        let lessons = [
            lesson(id: "past", minutesFromNow: -120),
            lesson(id: "live", minutesFromNow: -20, durationMinutes: 60),
            lesson(id: "future", minutesFromNow: 90),
        ]
        #expect(HomeDerivations.findCurrentLesson(lessons, now: now)?.id == "live")
        #expect(HomeDerivations.findCurrentLesson([lessons[0], lessons[2]], now: now) == nil)
    }

    @Test func cancelledLessonsNeverCount() {
        let now = Date()
        let lessons = [
            lesson(id: "cancelled-live", minutesFromNow: -10, cancelled: true),
            lesson(id: "cancelled-future", minutesFromNow: 60, cancelled: true),
        ]
        #expect(HomeDerivations.findCurrentLesson(lessons, now: now) == nil)
        #expect(HomeDerivations.nextLesson(lessons, now: now) == nil)
    }

    @Test func nextLessonIsSoonestFutureLesson() {
        let now = Date()
        let lessons = [
            lesson(id: "later", minutesFromNow: 300),
            lesson(id: "sooner", minutesFromNow: 45),
            lesson(id: "past", minutesFromNow: -30),
        ]
        #expect(HomeDerivations.nextLesson(lessons, now: now)?.id == "sooner")
    }

    @Test func todoLessonsArePastAndUnrecordedMostRecentFirst() {
        let now = Date()
        let lessons = [
            lesson(id: "older-todo", minutesFromNow: -2880),
            lesson(id: "recorded", minutesFromNow: -1440, attendanceStatus: "present"),
            lesson(id: "newer-todo", minutesFromNow: -60),
            lesson(id: "future", minutesFromNow: 60),
        ]
        let todos = HomeDerivations.todoLessons(lessons, now: now)
        #expect(todos.map(\.id) == ["newer-todo", "older-todo"])
    }

    @Test func timeUntilMirrorsWebStrings() {
        let now = Date()
        #expect(HomeDerivations.timeUntil(now.addingTimeInterval(-1), now: now) == "Started")
        #expect(HomeDerivations.timeUntil(now.addingTimeInterval(30), now: now) == "Now")
        #expect(HomeDerivations.timeUntil(now.addingTimeInterval(45 * 60), now: now) == "in 45 min")
        #expect(HomeDerivations.timeUntil(now.addingTimeInterval(195 * 60), now: now) == "in 3h 15m")
        #expect(HomeDerivations.timeUntil(now.addingTimeInterval(120 * 60), now: now) == "in 2h")
        #expect(HomeDerivations.timeUntil(now.addingTimeInterval(53 * 3600), now: now) == "in 2d 5h")
        #expect(HomeDerivations.timeUntil(now.addingTimeInterval(48 * 3600), now: now) == "in 2d")
    }

    @Test func deltaPercentMatchesWebBehaviour() {
        #expect(HomeDerivations.deltaPercent(current: 150, previous: 100) == 50)
        #expect(HomeDerivations.deltaPercent(current: 50, previous: 100) == -50)
        #expect(HomeDerivations.deltaPercent(current: 10, previous: 0) == 100)
        #expect(HomeDerivations.deltaPercent(current: 0, previous: 0) == nil)
    }

    @Test func formatHoursTrimsTrailingZero() {
        #expect(HomeDerivations.formatHours(12.5) == "12.5h")
        #expect(HomeDerivations.formatHours(12) == "12h")
        #expect(HomeDerivations.formatHours(0) == "0h")
    }

    @Test func currencyHasNoFractionDigits() {
        #expect(HomeDerivations.formatCurrencyWhole(1240, currency: "AUD") == "$1,240")
        #expect(HomeDerivations.formatCurrencyWhole(1240.75, currency: "AUD") == "$1,241")
    }

    @Test func lessonTimeRangeUsesProvidedTimeZone() {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Australia/Sydney")!
        let components = DateComponents(calendar: calendar, year: 2026, month: 6, day: 20,
                                        hour: 9, minute: 0, second: 0)
        var fixture = lesson(id: "range", minutesFromNow: 0, durationMinutes: 90)
        fixture.startDateTime = ISO8601DateFormatter().string(from: components.date!)
        #expect(HomeDerivations.lessonTimeRange(fixture, timeZone: calendar.timeZone) == "09:00 – 10:30")
    }

    @Test func relativeDayLabelIdentifiesTodayAndTomorrow() {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Australia/Perth")!
        let start = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: Date().addingTimeInterval(86400)))!
        #expect(HomeDerivations.relativeDayLabel(Date(), calendar: calendar) == "Today")
        #expect(HomeDerivations.relativeDayLabel(start, calendar: calendar) == "Tomorrow")
    }
}
