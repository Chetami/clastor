import Foundation

@MainActor
protocol UserServing {
    /// PATCH /api/users/me — partial update; nil fields are omitted from the
    /// encoded body (synthesized Codable uses encodeIfPresent).
    func updateMe(_ request: AuthModels.UpdateUserRequest, accessToken: String) async throws -> AuthModels.UserInfo
}

@MainActor
final class ProfileAPI: UserServing {
    private let client: BackendClient

    init(origin: URL, session: URLSession? = nil) {
        client = BackendClient(origin: origin, session: session)
    }

    static func live() -> any UserServing {
        #if DEBUG
        if AuthPreviewSupport.isUITesting || AuthPreviewSupport.isPreview {
            return ProfilePreviewSupport.api()
        }
        #endif
        guard let configuration = try? AppConfiguration.load() else {
            preconditionFailure("App configuration is invalid. Check the selected scheme.")
        }
        return ProfileAPI(origin: configuration.apiBaseURL)
    }

    func updateMe(_ request: AuthModels.UpdateUserRequest, accessToken: String) async throws -> AuthModels.UserInfo {
        try client.decode(
            await client.send(path: "api/users/me", method: "PATCH", bearer: accessToken,
                              body: try JSONEncoder().encode(request))
        )
    }
}
