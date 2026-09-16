import Foundation

@MainActor
protocol AuthServing {
    func login(firebaseIDToken: String) async throws -> AuthModels.LoginResponse
    func verify(accessToken: String) async throws -> AuthModels.UserInfo
    func refresh(refreshToken: String) async throws -> AuthModels.RefreshTokenResponse
    func logout(refreshToken: String) async throws
}

@MainActor
final class AuthAPI: AuthServing {
    private let client: BackendClient

    init(origin: URL, session: URLSession? = nil) {
        client = BackendClient(origin: origin, session: session)
    }

    func login(firebaseIDToken: String) async throws -> AuthModels.LoginResponse {
        try client.decode(await client.send(path: "api/auth/login", method: "POST", bearer: firebaseIDToken))
    }

    func verify(accessToken: String) async throws -> AuthModels.UserInfo {
        let response: AuthModels.VerifyTokenResponse = try client.decode(await client.send(path: "api/auth/verify", method: "GET", bearer: accessToken))
        return response.user
    }

    func refresh(refreshToken: String) async throws -> AuthModels.RefreshTokenResponse {
        try client.decode(await client.send(path: "api/auth/refresh", method: "POST", body: JSONEncoder().encode(AuthModels.RefreshTokenRequest(refreshToken: refreshToken))))
    }

    func logout(refreshToken: String) async throws {
        _ = try await client.send(path: "api/auth/logout", method: "POST", body: JSONEncoder().encode(AuthModels.RefreshTokenRequest(refreshToken: refreshToken)), timeout: 5)
    }

}
