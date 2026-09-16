import Foundation

@MainActor
protocol HomeServing {
    func summary(period: String, accessToken: String) async throws -> HomeModels.DashboardSummaryResponse
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
            return HomePreviewSupport.api()
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
}
