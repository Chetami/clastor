import Foundation
import Testing
@testable import Clastor

@MainActor
@Suite(.serialized)
struct AuthAPITests {
    private let userJSON = #"{"uid":"test-user","email":"tutor@example.test","role":"tutor","onboardingComplete":true,"tourSeen":false,"reminderLeadTime":null,"invoiceSettings":null,"emailReviewSettings":null,"workingHours":null,"signupSurvey":null}"#

    private func api(origin: String = "https://api.example.test") -> AuthAPI {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [AuthTestURLProtocol.self]
        return AuthAPI(origin: URL(string: origin)!, session: URLSession(configuration: configuration))
    }

    @Test func loginSendsOnlyFirebaseBearerToTheConfiguredOrigin() async throws {
        let response = #"{"jwtToken":"access","refreshToken":"refresh","user":USER}"#.replacingOccurrences(of: "USER", with: userJSON)
        AuthTestURLProtocol.handler = { request in
            #expect(request.url?.absoluteString == "https://api.example.test/api/auth/login")
            #expect(request.httpMethod == "POST")
            #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer firebase-identity")
            #expect(request.httpBody == nil)
            return (200, Data(response.utf8))
        }
        let result = try await api().login(firebaseIDToken: "firebase-identity")
        #expect(result.user.email == "tutor@example.test")
        #expect(result.user.invoiceSettings == nil)
        #expect(result.user.emailVerified == nil)
    }

    @Test func verifyUsesClastorAccessToken() async throws {
        let response = #"{"user":USER}"#.replacingOccurrences(of: "USER", with: userJSON)
        AuthTestURLProtocol.handler = { request in
            #expect(request.url?.path == "/api/auth/verify")
            #expect(request.httpMethod == "GET")
            #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer clastor-access")
            return (200, Data(response.utf8))
        }
        _ = try await api().verify(accessToken: "clastor-access")
    }

    @Test func refreshSendsJSONWithoutAnAccessBearer() async throws {
        let response = #"{"jwtToken":"next","refreshToken":"next-refresh","user":USER}"#.replacingOccurrences(of: "USER", with: userJSON)
        AuthTestURLProtocol.handler = { request in
            #expect(request.url?.path == "/api/auth/refresh")
            #expect(request.httpMethod == "POST")
            #expect(request.value(forHTTPHeaderField: "Authorization") == nil)
            let body = try JSONDecoder().decode(AuthModels.RefreshTokenRequest.self, from: AuthTestURLProtocol.body(request))
            #expect(body.refreshToken == "original-refresh")
            return (200, Data(response.utf8))
        }
        _ = try await api().refresh(refreshToken: "original-refresh")
    }

    @Test func logoutHasBoundedTimeoutAndNoAccessBearer() async throws {
        AuthTestURLProtocol.handler = { request in
            #expect(request.url?.path == "/api/auth/logout")
            #expect(request.timeoutInterval == 5)
            #expect(request.value(forHTTPHeaderField: "Authorization") == nil)
            return (200, Data(#"{"message":"Logged out"}"#.utf8))
        }
        try await api().logout(refreshToken: "logout-refresh")
    }

    @Test(arguments: [401, 403, 429, 503])
    func failuresAreTypedAndDoNotExposeServerBodies(status: Int) async {
        AuthTestURLProtocol.handler = { _ in (status, Data(#"{"message":"private-server-detail"}"#.utf8)) }
        do {
            _ = try await api().verify(accessToken: "test-token")
            Issue.record("Expected HTTP failure")
        } catch {
            #expect(error as? AuthFailure == (status == 401 ? .unauthorized : .http(status)))
            #expect(!AuthFailure.message(for: error).contains("private-server-detail"))
        }
    }

    @Test func malformedResponseIsNotASignedInUser() async {
        AuthTestURLProtocol.handler = { _ in (200, Data(#"{"user":{"email":"missing-required-fields"}}"#.utf8)) }
        await #expect(throws: AuthFailure.invalidResponse) {
            _ = try await api().verify(accessToken: "test-token")
        }
    }

    @Test func refusedLocalhostConnectionExplainsTheEnvironmentProblem() async {
        AuthTestURLProtocol.handler = { _ in throw URLError(.cannotConnectToHost) }
        await #expect(throws: AuthFailure.localServerUnavailable) {
            _ = try await api(origin: "http://localhost:3001").login(firebaseIDToken: "test-identity")
        }
    }

    @Test func remoteConnectionFailureKeepsTheNetworkMessage() async {
        AuthTestURLProtocol.handler = { _ in throw URLError(.cannotConnectToHost) }
        await #expect(throws: AuthFailure.network) {
            _ = try await api().login(firebaseIDToken: "test-identity")
        }
    }

    @Test func redirectsAreRejectedBeforeCredentialsCanFollow() async throws {
        let delegate = BackendRedirectBlocker()
        let url = URL(string: "https://api.example.test/api/auth/login")!
        let task = URLSession.shared.dataTask(with: url)
        let redirect = HTTPURLResponse(url: url, statusCode: 307, httpVersion: nil, headerFields: nil)!
        let request = URLRequest(url: URL(string: "https://different.example.test")!)
        let followed: URLRequest? = await withCheckedContinuation { continuation in
            delegate.urlSession(.shared, task: task, willPerformHTTPRedirection: redirect, newRequest: request) {
                continuation.resume(returning: $0)
            }
        }
        #expect(followed == nil)
        task.cancel()
    }

    @Test func studentsRequestUsesBackendJWTAndDecodesTheListContract() async throws {
        AuthTestURLProtocol.handler = { request in
            #expect(request.url?.absoluteString == "https://staging.example.test/api/students")
            #expect(request.httpMethod == "GET")
            #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer clastor-access")
            #expect(request.httpBody == nil)
            return (200, Data(#"{"data":[{"id":"student-1","name":"Alex Example","billingEmail":null,"billingEmailSource":"none","subjectIds":[],"expectedAmount":45,"rateType":"hourly","frequencyPerWeek":1,"status":"active","amountOwed":0,"createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z"}],"total":1}"#.utf8))
        }
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [AuthTestURLProtocol.self]
        let students = StudentsAPI(origin: URL(string: "https://staging.example.test")!, session: URLSession(configuration: configuration))
        let result = try await students.list(accessToken: "clastor-access")
        #expect(result.map(\.name) == ["Alex Example"])
        #expect(result.first?.billingEmail == nil)
    }

    @Test func emptyStudentResponseIsDistinctFromMalformedData() async throws {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [AuthTestURLProtocol.self]
        let students = StudentsAPI(origin: URL(string: "https://api.example.test")!, session: URLSession(configuration: configuration))
        AuthTestURLProtocol.handler = { _ in (200, Data(#"{"data":[],"total":0}"#.utf8)) }
        #expect(try await students.list(accessToken: "access").isEmpty)
        AuthTestURLProtocol.handler = { _ in (200, Data(#"{"unexpected":[]}"#.utf8)) }
        await #expect(throws: AuthFailure.invalidResponse) {
            _ = try await students.list(accessToken: "access")
        }
    }
}

nonisolated final class AuthTestURLProtocol: URLProtocol, @unchecked Sendable {
    // This suite is serialized; the callback runs on URLSession's worker thread.
    nonisolated(unsafe) static var handler: ((URLRequest) throws -> (Int, Data))?
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        do {
            let (status, data) = try Self.handler!(request)
            let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: ["Content-Type": "application/json"])!
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch { client?.urlProtocol(self, didFailWithError: error) }
    }
    override func stopLoading() {}
    static func body(_ request: URLRequest) throws -> Data {
        if let data = request.httpBody { return data }
        guard let stream = request.httpBodyStream else { return Data() }
        stream.open()
        defer { stream.close() }
        var data = Data()
        var buffer = [UInt8](repeating: 0, count: 1024)
        while stream.hasBytesAvailable {
            let count = stream.read(&buffer, maxLength: buffer.count)
            if count < 0 { throw stream.streamError ?? URLError(.unknown) }
            if count == 0 { break }
            data.append(contentsOf: buffer.prefix(count))
        }
        return data
    }
}
