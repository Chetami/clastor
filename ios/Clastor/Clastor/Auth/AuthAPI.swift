import Foundation

@MainActor
protocol AuthServing {
    func login(firebaseIDToken: String) async throws -> AuthModels.LoginResponse
    func verify(accessToken: String) async throws -> AuthModels.UserInfo
    func refresh(refreshToken: String) async throws -> AuthModels.RefreshTokenResponse
    func logout(refreshToken: String) async throws
}

// Credentials must never follow a server redirect to another origin.
final class AuthRedirectBlocker: NSObject, URLSessionTaskDelegate {
    nonisolated func urlSession(
        _ session: URLSession, task: URLSessionTask,
        willPerformHTTPRedirection response: HTTPURLResponse,
        newRequest request: URLRequest,
        completionHandler: @escaping @Sendable (URLRequest?) -> Void
    ) {
        completionHandler(nil)
    }
}

@MainActor
final class AuthAPI: AuthServing {
    private let origin: URL
    private let session: URLSession

    init(origin: URL, session: URLSession? = nil) {
        self.origin = origin
        let configuration = URLSessionConfiguration.ephemeral
        configuration.urlCache = nil
        configuration.httpCookieStorage = nil
        configuration.urlCredentialStorage = nil
        configuration.timeoutIntervalForRequest = 15
        configuration.timeoutIntervalForResource = 20
        self.session = session ?? URLSession(configuration: configuration, delegate: AuthRedirectBlocker(), delegateQueue: nil)
    }

    func login(firebaseIDToken: String) async throws -> AuthModels.LoginResponse {
        try decode(await send(path: "login", method: "POST", bearer: firebaseIDToken))
    }

    func verify(accessToken: String) async throws -> AuthModels.UserInfo {
        let response: AuthModels.VerifyTokenResponse = try decode(await send(path: "verify", method: "GET", bearer: accessToken))
        return response.user
    }

    func refresh(refreshToken: String) async throws -> AuthModels.RefreshTokenResponse {
        try decode(await send(path: "refresh", method: "POST", body: JSONEncoder().encode(AuthModels.RefreshTokenRequest(refreshToken: refreshToken))))
    }

    func logout(refreshToken: String) async throws {
        _ = try await send(path: "logout", method: "POST", body: JSONEncoder().encode(AuthModels.RefreshTokenRequest(refreshToken: refreshToken)), timeout: 5)
    }

    private func decode<T: Decodable>(_ data: Data) throws -> T {
        do { return try JSONDecoder().decode(T.self, from: data) }
        catch { throw AuthFailure.invalidResponse }
    }

    private func send(path: String, method: String, bearer: String? = nil, body: Data? = nil, timeout: TimeInterval = 15) async throws -> Data {
        var request = URLRequest(url: origin.appending(path: "api/auth/\(path)"))
        request.httpMethod = method
        request.httpBody = body
        request.timeoutInterval = timeout
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if body != nil { request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
        if let bearer { request.setValue("Bearer \(bearer)", forHTTPHeaderField: "Authorization") }
        let data: Data
        let response: URLResponse
        do { (data, response) = try await session.data(for: request) }
        catch is CancellationError { throw AuthFailure.cancelled }
        catch { throw AuthFailure.network }
        guard let response = response as? HTTPURLResponse else { throw AuthFailure.invalidResponse }
        guard (200..<300).contains(response.statusCode) else {
            if response.statusCode == 401 { throw AuthFailure.unauthorized }
            throw AuthFailure.http(response.statusCode)
        }
        return data
    }
}
