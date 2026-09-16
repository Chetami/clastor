#if DEBUG
import Foundation

// Lessons preview fake — reads and mutates the shared PreviewStore so
// mutations surface in every tab during previews and UI tests.
@MainActor
enum LessonPreviewSupport {

@MainActor
static func api() -> any LessonServing { PreviewLessonAPI(mode: AuthPreviewSupport.activeScenario) }

private final class PreviewLessonAPI: LessonServing {
    let mode: String
    init(mode: String) { self.mode = mode }

    func list(filters: LessonListFilters, accessToken: String) async throws -> [LessonModels.LessonResponse] {
        if mode == "lessons-unavailable" { throw AuthFailure.network }
        return PreviewStore.shared.lessons.filter { lesson in
            if let studentId = filters.studentId, lesson.studentId != studentId { return false }
            if filters.unpaid, lesson.isPaid || lesson.invoiceId != nil { return false }
            if let acceptanceStatus = filters.acceptanceStatus, lesson.acceptanceStatus != acceptanceStatus { return false }
            if let attendanceStatus = filters.attendanceStatus, lesson.attendanceStatus != attendanceStatus { return false }
            if let from = filters.from,
               let start = HomeDerivations.date(lesson.startDateTime), start < from { return false }
            if let to = filters.to,
               let start = HomeDerivations.date(lesson.startDateTime), start >= to { return false }
            return true
        }
    }

    func lesson(id: String, accessToken: String) async throws -> LessonModels.LessonResponse {
        guard let lesson = PreviewStore.shared.lesson(id: id) else { throw AuthFailure.invalidResponse }
        return lesson
    }

    func create(_ request: LessonModels.CreateLessonRequest, accessToken: String) async throws -> LessonModels.LessonResponse {
        let response = LessonModels.LessonResponse(
            id: "preview-\(UUID().uuidString.prefix(8).lowercased())",
            studentId: request.studentId, subject: request.subject,
            startDateTime: request.startDateTime, durationMinutes: request.durationMinutes,
            location: request.location, notes: request.notes, todos: [],
            acceptanceStatus: "pending", attendanceStatus: "unrecorded",
            remindersEnabled: request.remindersEnabled ?? true, isPaid: false,
            createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z"
        )
        PreviewStore.shared.upsert(response)
        return response
    }

    func createRecurring(_ request: LessonModels.CreateRecurringLessonRequest, accessToken: String) async throws -> LessonModels.CreateRecurringLessonResponse {
        let count = min(request.count ?? 8, 8)
        for occurrence in 0..<count {
            let dayOffset = occurrence * request.intervalWeeks * 7
            let date = Date().addingTimeInterval(TimeInterval(dayOffset) * 86_400)
            PreviewStore.shared.upsert(LessonModels.LessonResponse(
                id: "preview-\(UUID().uuidString.prefix(8).lowercased())",
                studentId: request.studentId, subject: request.subject,
                startDateTime: ISO8601DateFormatter().string(from: date),
                durationMinutes: request.durationMinutes, location: request.location,
                notes: request.notes, todos: [], acceptanceStatus: "pending",
                attendanceStatus: "unrecorded", seriesId: "preview-series",
                remindersEnabled: request.remindersEnabled ?? true, isPaid: false,
                createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z"
            ))
        }
        return LessonModels.CreateRecurringLessonResponse(seriesId: "preview-series", count: count)
    }

    func update(id: String, _ request: LessonModels.UpdateLessonRequest, accessToken: String) async throws -> LessonModels.LessonResponse {
        guard let lesson = PreviewStore.shared.lesson(id: id) else { throw AuthFailure.invalidResponse }
        var next = lesson
        if request.subject != nil { next.subject = request.subject }
        if request.startDateTime != nil { next.startDateTime = request.startDateTime! }
        if let durationMinutes = request.durationMinutes { next.durationMinutes = durationMinutes }
        if request.location != nil { next.location = request.location }
        if request.meetLink != nil { next.meetLink = request.meetLink }
        if request.notes != nil { next.notes = request.notes }
        if let todos = request.todos { next.todos = todos }
        if let remindersEnabled = request.remindersEnabled { next.remindersEnabled = remindersEnabled }
        if let isPaid = request.isPaid { next.isPaid = isPaid }
        PreviewStore.shared.upsert(next)
        return next
    }

    func reschedule(id: String, _ request: LessonModels.RescheduleLessonRequest, accessToken: String) async throws -> LessonModels.LessonResponse {
        var response: LessonModels.LessonResponse?
        PreviewStore.shared.apply(id) { lesson in
            lesson.startDateTime = request.startDateTime
            if let durationMinutes = request.durationMinutes { lesson.durationMinutes = durationMinutes }
            if request.notifyStudent == true { lesson.acceptanceStatus = "pending" }
            response = lesson
        }
        guard let response else { throw AuthFailure.invalidResponse }
        return response
    }

    func reschedulePreview(id: String, _ request: LessonModels.RescheduleLessonRequest, accessToken: String) async throws -> LessonModels.EmailPreviewResponse {
        PreviewStore.shared.emailPreview(
            subject: "Updated lesson time",
            to: PreviewStore.shared.student(id: PreviewStore.shared.lesson(id: id)?.studentId ?? "")?.email.map { [$0] } ?? [],
            message: request.message)
    }

    func cancel(id: String, _ request: LessonModels.CancelLessonRequest, accessToken: String) async throws -> LessonModels.LessonResponse {
        var response: LessonModels.LessonResponse?
        PreviewStore.shared.apply(id) { lesson in
            lesson.isCancelled = true
            response = lesson
        }
        guard let response else { throw AuthFailure.invalidResponse }
        return response
    }

    func cancelPreview(id: String, _ request: LessonModels.CancelLessonRequest, accessToken: String) async throws -> LessonModels.EmailPreviewResponse {
        PreviewStore.shared.emailPreview(
            subject: "Lesson cancelled",
            to: PreviewStore.shared.student(id: PreviewStore.shared.lesson(id: id)?.studentId ?? "")?.email.map { [$0] } ?? [],
            message: request.message)
    }

    func notifyStudent(id: String, message: String?, accessToken: String) async throws -> LessonModels.LessonResponse {
        var response: LessonModels.LessonResponse?
        PreviewStore.shared.apply(id) { lesson in
            lesson.lastStudentNotifiedAt = ISO8601DateFormatter().string(from: Date())
            lesson.studentNotifiedCount = (lesson.studentNotifiedCount ?? 0) + 1
            response = lesson
        }
        guard let response else { throw AuthFailure.invalidResponse }
        return response
    }

    func notifyStudentPreview(id: String, message: String?, accessToken: String) async throws -> LessonModels.EmailPreviewResponse {
        PreviewStore.shared.emailPreview(
            subject: "Lesson reminder",
            to: PreviewStore.shared.student(id: PreviewStore.shared.lesson(id: id)?.studentId ?? "")?.email.map { [$0] } ?? [],
            message: message)
    }

    func recordAttendance(id: String, status: String, accessToken: String) async throws -> LessonModels.LessonResponse {
        var response: LessonModels.LessonResponse?
        PreviewStore.shared.apply(id) { lesson in
            lesson.attendanceStatus = status
            response = lesson
        }
        guard let response else { throw AuthFailure.invalidResponse }
        return response
    }

    func generateMeetLink(_ request: LessonModels.GenerateMeetLinkRequest, accessToken: String) async throws -> LessonModels.GenerateMeetLinkResponse {
        LessonModels.GenerateMeetLinkResponse(
            meetingLink: "https://meet.google.com/preview-\(UUID().uuidString.prefix(6).lowercased())",
            calendarEventId: "preview-event-\(UUID().uuidString.prefix(6).lowercased())")
    }
}
}
#endif
