import Foundation

// Credentials must never follow a server redirect to another origin.
final class BackendRedirectBlocker: NSObject, URLSessionTaskDelegate {
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
final class BackendClient {
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
        self.session = session ?? URLSession(configuration: configuration, delegate: BackendRedirectBlocker(), delegateQueue: nil)
    }

    func decode<T: Decodable>(_ data: Data) throws -> T {
        do { return try JSONDecoder().decode(T.self, from: data) }
        catch { throw AuthFailure.invalidResponse }
    }

    func send(path: String, query: [URLQueryItem] = [], method: String, bearer: String? = nil, body: Data? = nil, timeout: TimeInterval = 15) async throws -> Data {
        // URL.appending(path:) percent-encodes "?", so build query items here.
        guard var components = URLComponents(url: origin.appending(path: path), resolvingAgainstBaseURL: false) else {
            throw AuthFailure.invalidResponse
        }
        if !query.isEmpty { components.queryItems = query }
        guard let url = components.url else { throw AuthFailure.invalidResponse }
        var request = URLRequest(url: url)
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
        catch let error as URLError {
            if error.code == .cancelled { throw AuthFailure.cancelled }
            if error.code == .cannotConnectToHost,
               ["localhost", "127.0.0.1", "::1", "[::1]"].contains(origin.host?.lowercased() ?? "") {
                throw AuthFailure.localServerUnavailable
            }
            throw AuthFailure.network
        }
        catch { throw AuthFailure.network }
        guard let response = response as? HTTPURLResponse else { throw AuthFailure.invalidResponse }
        guard (200..<300).contains(response.statusCode) else {
            if response.statusCode == 401 { throw AuthFailure.unauthorized }
            throw AuthFailure.http(response.statusCode)
        }
        return data
    }
}
