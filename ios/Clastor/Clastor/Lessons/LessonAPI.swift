import Foundation

/// Filters for the unpaginated GET /api/lessons mode (calendar window,
/// dashboard, invoice building). Omitting `limit` returns the full set.
struct LessonListFilters: Sendable {
    var from: Date?
    var to: Date?
    var studentId: String?
    var seriesId: String?
    var unpaid: Bool = false
    var acceptanceStatus: String?
    var attendanceStatus: String?

    var queryItems: [URLQueryItem] {
        var items: [URLQueryItem] = []
        if let from { items.append(URLQueryItem(name: "from", value: ISO8601DateFormatter().string(from: from))) }
        if let to { items.append(URLQueryItem(name: "to", value: ISO8601DateFormatter().string(from: to))) }
        if let studentId { items.append(URLQueryItem(name: "studentId", value: studentId)) }
        if let seriesId { items.append(URLQueryItem(name: "seriesId", value: seriesId)) }
        if unpaid { items.append(URLQueryItem(name: "unpaid", value: "true")) }
        if let acceptanceStatus { items.append(URLQueryItem(name: "acceptanceStatus", value: acceptanceStatus)) }
        if let attendanceStatus { items.append(URLQueryItem(name: "attendanceStatus", value: attendanceStatus)) }
        return items
    }
}

@MainActor
protocol LessonServing {
    func list(filters: LessonListFilters, accessToken: String) async throws -> [LessonModels.LessonResponse]
    func lesson(id: String, accessToken: String) async throws -> LessonModels.LessonResponse
    func create(_ request: LessonModels.CreateLessonRequest, accessToken: String) async throws -> LessonModels.LessonResponse
    func createRecurring(_ request: LessonModels.CreateRecurringLessonRequest, accessToken: String) async throws -> LessonModels.CreateRecurringLessonResponse
    /// Partial update — nil fields are omitted from the encoded body.
    func update(id: String, _ request: LessonModels.UpdateLessonRequest, accessToken: String) async throws -> LessonModels.LessonResponse
    func reschedule(id: String, _ request: LessonModels.RescheduleLessonRequest, accessToken: String) async throws -> LessonModels.LessonResponse
    func reschedulePreview(id: String, _ request: LessonModels.RescheduleLessonRequest, accessToken: String) async throws -> LessonModels.EmailPreviewResponse
    func cancel(id: String, _ request: LessonModels.CancelLessonRequest, accessToken: String) async throws -> LessonModels.LessonResponse
    func cancelPreview(id: String, _ request: LessonModels.CancelLessonRequest, accessToken: String) async throws -> LessonModels.EmailPreviewResponse
    func notifyStudent(id: String, message: String?, accessToken: String) async throws -> LessonModels.LessonResponse
    func notifyStudentPreview(id: String, message: String?, accessToken: String) async throws -> LessonModels.EmailPreviewResponse
    func recordAttendance(id: String, status: String, accessToken: String) async throws -> LessonModels.LessonResponse
    func generateMeetLink(_ request: LessonModels.GenerateMeetLinkRequest, accessToken: String) async throws -> LessonModels.GenerateMeetLinkResponse
}

@MainActor
final class LessonAPI: LessonServing {
    private let client: BackendClient

    init(origin: URL, session: URLSession? = nil) {
        client = BackendClient(origin: origin, session: session)
    }

    static func live() -> any LessonServing {
        #if DEBUG
        if AuthPreviewSupport.isUITesting || AuthPreviewSupport.isPreview {
            return LessonPreviewSupport.api()
        }
        #endif
        guard let configuration = try? AppConfiguration.load() else {
            preconditionFailure("App configuration is invalid. Check the selected scheme.")
        }
        return LessonAPI(origin: configuration.apiBaseURL)
    }

    func list(filters: LessonListFilters, accessToken: String) async throws -> [LessonModels.LessonResponse] {
        let response: LessonModels.LessonListResponse = try client.decode(
            await client.send(path: "api/lessons", query: filters.queryItems, method: "GET", bearer: accessToken)
        )
        return response.data
    }

    func lesson(id: String, accessToken: String) async throws -> LessonModels.LessonResponse {
        try client.decode(await client.send(path: "api/lessons/\(id)", method: "GET", bearer: accessToken))
    }

    func create(_ request: LessonModels.CreateLessonRequest, accessToken: String) async throws -> LessonModels.LessonResponse {
        try client.decode(
            await client.send(path: "api/lessons", method: "POST", bearer: accessToken,
                              body: try JSONEncoder().encode(request))
        )
    }

    func createRecurring(_ request: LessonModels.CreateRecurringLessonRequest, accessToken: String) async throws -> LessonModels.CreateRecurringLessonResponse {
        try client.decode(
            await client.send(path: "api/lessons/recurring", method: "POST", bearer: accessToken,
                              body: try JSONEncoder().encode(request))
        )
    }

    func update(id: String, _ request: LessonModels.UpdateLessonRequest, accessToken: String) async throws -> LessonModels.LessonResponse {
        try client.decode(
            await client.send(path: "api/lessons/\(id)", method: "PATCH", bearer: accessToken,
                              body: try JSONEncoder().encode(request))
        )
    }

    func reschedule(id: String, _ request: LessonModels.RescheduleLessonRequest, accessToken: String) async throws -> LessonModels.LessonResponse {
        try client.decode(
            await client.send(path: "api/lessons/\(id)/reschedule", method: "PATCH", bearer: accessToken,
                              body: try JSONEncoder().encode(request))
        )
    }

    func reschedulePreview(id: String, _ request: LessonModels.RescheduleLessonRequest, accessToken: String) async throws -> LessonModels.EmailPreviewResponse {
        try client.decode(
            await client.send(path: "api/lessons/\(id)/reschedule/preview", method: "PATCH", bearer: accessToken,
                              body: try JSONEncoder().encode(request))
        )
    }

    func cancel(id: String, _ request: LessonModels.CancelLessonRequest, accessToken: String) async throws -> LessonModels.LessonResponse {
        try client.decode(
            await client.send(path: "api/lessons/\(id)/cancel", method: "PATCH", bearer: accessToken,
                              body: try JSONEncoder().encode(request))
        )
    }

    func cancelPreview(id: String, _ request: LessonModels.CancelLessonRequest, accessToken: String) async throws -> LessonModels.EmailPreviewResponse {
        try client.decode(
            await client.send(path: "api/lessons/\(id)/cancel/preview", method: "PATCH", bearer: accessToken,
                              body: try JSONEncoder().encode(request))
        )
    }

    func notifyStudent(id: String, message: String?, accessToken: String) async throws -> LessonModels.LessonResponse {
        try client.decode(
            await client.send(path: "api/lessons/\(id)/notify-student", method: "POST", bearer: accessToken,
                              body: try JSONEncoder().encode(LessonModels.NotifyStudentRequest(message: message)))
        )
    }

    func notifyStudentPreview(id: String, message: String?, accessToken: String) async throws -> LessonModels.EmailPreviewResponse {
        try client.decode(
            await client.send(path: "api/lessons/\(id)/notify-student/preview", method: "POST", bearer: accessToken,
                              body: try JSONEncoder().encode(LessonModels.NotifyStudentRequest(message: message)))
        )
    }

    func recordAttendance(id: String, status: String, accessToken: String) async throws -> LessonModels.LessonResponse {
        try client.decode(
            await client.send(path: "api/lessons/\(id)/attendance", method: "PATCH", bearer: accessToken,
                              body: try JSONEncoder().encode(LessonModels.RecordAttendanceRequest(attendanceStatus: status)))
        )
    }

    func generateMeetLink(_ request: LessonModels.GenerateMeetLinkRequest, accessToken: String) async throws -> LessonModels.GenerateMeetLinkResponse {
        try client.decode(
            await client.send(path: "api/meetings", method: "POST", bearer: accessToken,
                              body: try JSONEncoder().encode(request))
        )
    }
}
