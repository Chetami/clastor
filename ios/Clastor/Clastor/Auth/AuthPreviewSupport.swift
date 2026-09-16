#if DEBUG
import Foundation

// Offline dependencies for previews and UI tests. No real Firebase, API or
// Keychain is reachable through this session. Omitted from Release builds.
@MainActor
enum AuthPreviewSupport {
    static var isUITesting: Bool { ProcessInfo.processInfo.arguments.contains("--auth-ui-test") }
    static var isPreview: Bool { ProcessInfo.processInfo.environment["XCODE_RUNNING_FOR_PREVIEWS"] == "1" }

    static func studentsAPI() -> any StudentsServing {
        PreviewStudentsAPI(mode: ProcessInfo.processInfo.environment["AUTH_TEST_SCENARIO"] ?? "success")
    }

    static func session() -> SessionStore {
        let mode = ProcessInfo.processInfo.environment["AUTH_TEST_SCENARIO"] ?? "success"
        return SessionStore(appName: "Clastor", identity: PreviewIdentity(reject: mode == "invalid-password"),
                            api: PreviewAPI(unavailable: mode == "backend-unavailable"), storage: PreviewStorage())
    }
}

@MainActor
private final class PreviewIdentity: FirebaseSigningIn {
    let reject: Bool
    init(reject: Bool) { self.reject = reject }
    func signIn(email: String, password: String) async throws -> String {
        if reject { throw AuthFailure.invalidCredentials }
        return "offline-preview-identity"
    }
    func signOut() throws {}
}

@MainActor
private final class PreviewAPI: AuthServing {
    let unavailable: Bool
    let user = AuthModels.UserInfo(uid: "preview-user", name: "Test Tutor", email: "tutor@example.test", role: "tutor", emailVerified: true, onboardingComplete: true, tourSeen: true)
    init(unavailable: Bool) { self.unavailable = unavailable }
    func login(firebaseIDToken: String) async throws -> AuthModels.LoginResponse {
        if unavailable { throw AuthFailure.http(503) }
        return .init(jwtToken: "offline-preview-access", refreshToken: "offline-preview-refresh", user: user)
    }
    func verify(accessToken: String) async throws -> AuthModels.UserInfo { user }
    func refresh(refreshToken: String) async throws -> AuthModels.RefreshTokenResponse {
        .init(jwtToken: "offline-preview-access", refreshToken: "offline-preview-refresh", user: user)
    }
    func logout(refreshToken: String) async throws {}
}

@MainActor
private final class PreviewStorage: TokenStoring {
    var value: SessionCredentials?
    func read() throws -> SessionCredentials? { value }
    func save(_ credentials: SessionCredentials) throws { value = credentials }
    func clear() throws { value = nil }
}

@MainActor
private final class PreviewStudentsAPI: StudentsServing {
    let mode: String
    init(mode: String) { self.mode = mode }

    func list(accessToken: String) async throws -> [StudentModels.StudentResponse] {
        if mode == "students-unavailable" { throw AuthFailure.network }
        if mode == "students-empty" { return [] }
        return ["Alex Example", "Sam Example"].enumerated().map { index, name in
            StudentModels.StudentResponse(id: "preview-\(index)", name: name,
                billingEmailSource: "none", subjectIds: [], expectedAmount: 0,
                rateType: "hourly", frequencyPerWeek: 1, status: "active", amountOwed: 0,
                createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z")
        }
    }
}
#endif
