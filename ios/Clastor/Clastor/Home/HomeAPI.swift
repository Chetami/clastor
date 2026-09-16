import Foundation

@MainActor
protocol HomeServing {
    func summary(period: String, accessToken: String) async throws -> HomeModels.DashboardSummaryResponse
    func lessons(accessToken: String) async throws -> [HomeModels.LessonResponse]
    func recordAttendance(id: String, status: String, accessToken: String) async throws -> HomeModels.LessonResponse
}

@MainActor
final class HomeAPI: HomeServing {
    private let client: BackendClient

    init(origin: URL, session: URLSession? = nil) {
        client = BackendClient(origin: origin, session: session)
    }

    static func live() -> any HomeServing {
        #if DEBUG
        if AuthPreviewSupport.isUITesting || AuthPreviewSupport.isPreview {
            return AuthPreviewSupport.homeAPI()
        }
        #endif
        guard let configuration = try? AppConfiguration.load() else {
            preconditionFailure("App configuration is invalid. Check the selected scheme.")
        }
        return HomeAPI(origin: configuration.apiBaseURL)
    }

    func summary(period: String, accessToken: String) async throws -> HomeModels.DashboardSummaryResponse {
        try client.decode(
            await client.send(path: "api/dashboard/summary",
                              query: [URLQueryItem(name: "period", value: period)],
                              method: "GET",
                              bearer: accessToken)
        )
    }

    func lessons(accessToken: String) async throws -> [HomeModels.LessonResponse] {
        // Omitting `limit` returns the full matching set, like the web dashboard.
        let response: HomeModels.LessonListResponse = try client.decode(
            await client.send(path: "api/lessons", method: "GET", bearer: accessToken)
        )
        return response.data
    }

    func recordAttendance(id: String, status: String, accessToken: String) async throws -> HomeModels.LessonResponse {
        let body = try JSONEncoder().encode(HomeModels.RecordAttendanceRequest(attendanceStatus: status))
        return try client.decode(
            await client.send(path: "api/lessons/\(id)/attendance", method: "PATCH", bearer: accessToken, body: body)
        )
    }
}
