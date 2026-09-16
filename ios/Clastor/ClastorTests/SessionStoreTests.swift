import Foundation
import Testing
@testable import Clastor

@MainActor
struct SessionStoreTests {
    private let user = AuthModels.UserInfo(uid: "test-user", name: "Test Tutor", email: "tutor@example.test", role: "tutor", onboardingComplete: true, tourSeen: true)

    private func make(storage: TestTokenStore? = nil) -> (SessionStore, TestIdentity, TestAuthAPI, TestTokenStore) {
        let storage = storage ?? TestTokenStore()
        let identity = TestIdentity()
        let api = TestAuthAPI(user: user)
        return (SessionStore(appName: "Test", identity: identity, api: api, storage: storage), identity, api, storage)
    }

    @Test func loginExchangesFirebaseIdentityAndPersistsBeforeShowingUser() async {
        let (session, identity, api, storage) = make()
        await session.restore()
        await session.signIn(email: "  tutor@example.test\n", password: "password with spaces ")
        #expect(identity.submittedEmail == "tutor@example.test")
        #expect(identity.submittedPassword == "password with spaces ")
        #expect(api.exchangedToken == "firebase-test-token")
        #expect(storage.value == SessionCredentials(accessToken: "access", refreshToken: "refresh"))
        #expect(session.phase == .signedIn(user))
    }

    @Test func rejectedPasswordNeverCallsBackendOrPersistsCredentials() async {
        let (session, identity, api, storage) = make()
        identity.failure = .invalidCredentials
        await session.restore()
        await session.signIn(email: "tutor@example.test", password: "wrong")
        #expect(session.phase == .signedOut)
        #expect(session.message == AuthFailure.invalidCredentials.message)
        #expect(api.exchangedToken == nil)
        #expect(storage.value == nil)
    }

    @Test func backendFailureNeverShowsFirebaseOnlySignIn() async {
        let (session, identity, api, storage) = make()
        api.loginFailure = .http(503)
        await session.restore()
        await session.signIn(email: "tutor@example.test", password: "password")
        #expect(session.phase == .signedOut)
        #expect(storage.value == nil)
        #expect(identity.signOutCount == 1)
    }

    @Test func keychainFailureDoesNotPublishUserAndRevokesNewSession() async {
        let (session, _, api, storage) = make()
        storage.failSave = true
        await session.restore()
        await session.signIn(email: "tutor@example.test", password: "password")
        #expect(session.phase == .signedOut)
        #expect(session.message == AuthFailure.secureStorage.message)
        await Task.yield()
        #expect(api.revokedTokens == ["refresh"])
    }

    @Test func restoresOnlyAfterBackendVerification() async {
        let storage = TestTokenStore(value: SessionCredentials(accessToken: "saved-access", refreshToken: "saved-refresh"))
        let (session, identity, api, _) = make(storage: storage)
        await session.restore()
        #expect(api.verifiedTokens == ["saved-access"])
        #expect(session.phase == .signedIn(user))
        #expect(identity.submittedEmail == nil)
    }

    @Test(arguments: [AuthFailure.network, .http(429), .http(503), .http(403)])
    func verificationOutagesPreserveCredentialsAndAllowRetry(error: AuthFailure) async {
        let saved = SessionCredentials(accessToken: "saved", refreshToken: "refresh")
        let (session, _, api, storage) = make(storage: TestTokenStore(value: saved))
        api.verifyFailure = error
        await session.restore()
        #expect(session.phase == .retry)
        #expect(storage.value == saved)
        #expect(api.refreshCount == 0)
        api.verifyFailure = nil
        await session.checkSession()
        #expect(session.phase == .signedIn(user))
    }

    @Test func expiredAccessTokenRotatesOnceAndUsesReturnedUser() async {
        let (session, _, api, storage) = make(storage: TestTokenStore(value: SessionCredentials(accessToken: "expired", refreshToken: "original")))
        api.verifyFailure = .unauthorized
        api.user.emailVerified = true
        await session.restore()
        #expect(api.refreshCount == 1)
        #expect(storage.saved.first?.refreshInProgress == true)
        #expect(storage.value == SessionCredentials(accessToken: "rotated-access", refreshToken: "rotated-refresh"))
        #expect(session.phase == .signedIn(api.user))
    }

    @Test func concurrentChecksShareOneRotation() async {
        let (session, _, api, _) = make(storage: TestTokenStore(value: SessionCredentials(accessToken: "expired", refreshToken: "original")))
        api.verifyFailure = .unauthorized
        api.pauseRefresh = true
        let first = Task { await session.restore() }
        await waitUntil { api.refreshContinuation != nil }
        let second = Task { await session.checkSession() }
        await Task.yield()
        api.finishRefresh()
        await first.value
        await second.value
        #expect(api.refreshCount == 1)
        #expect(session.phase == .signedIn(user))
    }

    @Test func logoutWinsAgainstLateRefreshSuccess() async {
        let (session, _, api, storage) = make(storage: TestTokenStore(value: SessionCredentials(accessToken: "expired", refreshToken: "original")))
        api.verifyFailure = .unauthorized
        api.pauseRefresh = true
        let pending = Task { await session.restore() }
        await waitUntil { api.refreshContinuation != nil }
        session.signOut()
        api.finishRefresh()
        await pending.value
        await Task.yield()
        #expect(session.phase == .signedOut)
        #expect(storage.value == nil)
        #expect(api.revokedTokens.contains("original"))
        #expect(api.revokedTokens.contains("rotated-refresh"))
    }

    @Test func refreshRejectionClearsTheSession() async {
        let (session, _, api, storage) = make(storage: TestTokenStore(value: SessionCredentials(accessToken: "expired", refreshToken: "revoked")))
        api.verifyFailure = .unauthorized
        api.refreshFailure = .unauthorized
        await session.restore()
        #expect(session.phase == .signedOut)
        #expect(storage.value == nil)
    }

    @Test func lostRefreshResponseRequiresLoginInsteadOfReplaying() async {
        let (session, _, api, storage) = make(storage: TestTokenStore(value: SessionCredentials(accessToken: "expired", refreshToken: "original")))
        api.verifyFailure = .unauthorized
        api.refreshFailure = .network
        await session.restore()
        await session.checkSession()
        #expect(api.refreshCount == 1)
        #expect(session.phase == .signedOut)
        #expect(storage.value == nil)
    }

    @Test func interruptedRotationFromPreviousLaunchIsNeverSentAgain() async {
        let (session, _, api, _) = make(storage: TestTokenStore(value: SessionCredentials(accessToken: "old", refreshToken: "consumed", refreshInProgress: true)))
        await session.restore()
        #expect(session.phase == .signedOut)
        #expect(api.refreshCount == 0)
        #expect(api.verifiedTokens.isEmpty)
    }

    @Test func refreshRateLimitRetainsAnUnconsumedToken() async {
        let saved = SessionCredentials(accessToken: "expired", refreshToken: "original")
        let (session, _, api, storage) = make(storage: TestTokenStore(value: saved))
        api.verifyFailure = .unauthorized
        api.refreshFailure = .http(429)
        await session.restore()
        #expect(session.phase == .retry)
        #expect(storage.value == saved)
    }

    @Test func unavailableKeychainDoesNotBecomeAnEmptySession() async {
        let (session, _, api, storage) = make()
        storage.failRead = true
        await session.restore()
        #expect(session.phase == .retry)
        #expect(api.verifiedTokens.isEmpty)
    }

    @Test func logoutCompletesLocallyEvenWhenRevocationFails() async {
        let (session, identity, api, storage) = make(storage: TestTokenStore(value: SessionCredentials(accessToken: "saved", refreshToken: "refresh")))
        await session.restore()
        api.logoutFails = true
        session.signOut()
        #expect(session.phase == .signedOut)
        #expect(storage.value == nil)
        #expect(identity.signOutCount == 1)
    }

    @Test func featureRequestUsesClastorToken() async throws {
        let (session, _, _, _) = make(storage: TestTokenStore(value: SessionCredentials(accessToken: "clastor-access", refreshToken: "refresh")))
        await session.restore()
        let result = try await session.authenticated { token in
            #expect(token == "clastor-access")
            return ["Student"]
        }
        #expect(result == ["Student"])
    }

    @Test func concurrentFeatureRequestsShareRefreshAndRetainSignedInUI() async throws {
        let (session, _, api, storage) = make(storage: TestTokenStore(value: SessionCredentials(accessToken: "old", refreshToken: "refresh")))
        await session.restore()
        api.verifyFailure = .unauthorized
        api.pauseRefresh = true
        let request: (String) async throws -> String = { token in
            if token == "old" { throw AuthFailure.unauthorized }
            return token
        }
        let first = Task { try await session.authenticated(request) }
        await waitUntil { api.refreshContinuation != nil }
        let second = Task { try await session.authenticated(request) }
        await Task.yield()
        #expect(session.phase == .signedIn(user))
        api.finishRefresh()
        #expect(try await first.value == "rotated-access")
        #expect(try await second.value == "rotated-access")
        #expect(api.refreshCount == 1)
        #expect(storage.value?.refreshToken == "rotated-refresh")
    }

    @Test func secondFeatureUnauthorizedSignsOutInsteadOfLooping() async {
        let (session, _, api, storage) = make(storage: TestTokenStore(value: SessionCredentials(accessToken: "old", refreshToken: "refresh")))
        await session.restore()
        api.verifyFailure = .unauthorized
        var attempts = 0
        await #expect(throws: AuthFailure.unauthorized) {
            try await session.authenticated { _ -> String in
                attempts += 1
                throw AuthFailure.unauthorized
            }
        }
        #expect(attempts == 2)
        #expect(api.refreshCount == 1)
        #expect(session.phase == .signedOut)
        #expect(storage.value == nil)
    }

    @Test(arguments: [AuthFailure.network, .http(403), .http(503)])
    func featureFailurePreservesSessionWithoutRefresh(error: AuthFailure) async {
        let (session, _, api, storage) = make(storage: TestTokenStore(value: SessionCredentials(accessToken: "access", refreshToken: "refresh")))
        await session.restore()
        await #expect(throws: error) {
            try await session.authenticated { _ -> String in throw error }
        }
        #expect(session.phase == .signedIn(user))
        #expect(storage.value?.accessToken == "access")
        #expect(api.refreshCount == 0)
    }

    @Test func lateFeatureResponseCannotReturnDataAfterLogout() async {
        let (session, _, _, _) = make(storage: TestTokenStore(value: SessionCredentials(accessToken: "access", refreshToken: "refresh")))
        await session.restore()
        var continuation: CheckedContinuation<String, Never>?
        let pending = Task {
            try await session.authenticated { _ in
                await withCheckedContinuation { continuation = $0 }
            }
        }
        await waitUntil { continuation != nil }
        session.signOut()
        continuation?.resume(returning: "private student data")
        await #expect(throws: CancellationError.self) { try await pending.value }
    }

    @Test func signedOutFeatureRequestDoesNotCallTheBackend() async {
        let (session, _, _, _) = make()
        await session.restore()
        await #expect(throws: AuthFailure.unauthorized) {
            try await session.authenticated { _ -> String in
                Issue.record("Signed-out request reached the backend")
                return "unexpected"
            }
        }
    }

    private func waitUntil(_ ready: () -> Bool) async {
        for _ in 0..<1000 {
            if ready() { return }
            await Task.yield()
        }
        Issue.record("The expected asynchronous request did not start")
    }
}

@MainActor
final class TestIdentity: FirebaseSigningIn {
    var submittedEmail: String?
    var submittedPassword: String?
    var failure: AuthFailure?
    var signOutCount = 0
    func signIn(email: String, password: String) async throws -> String {
        submittedEmail = email
        submittedPassword = password
        if let failure { throw failure }
        return "firebase-test-token"
    }
    func signOut() throws { signOutCount += 1 }
}

@MainActor
final class TestTokenStore: TokenStoring {
    var value: SessionCredentials?
    var saved: [SessionCredentials] = []
    var failRead = false
    var failSave = false
    init(value: SessionCredentials? = nil) { self.value = value }
    func read() throws -> SessionCredentials? {
        if failRead { throw AuthFailure.secureStorage }
        return value
    }
    func save(_ credentials: SessionCredentials) throws {
        if failSave { throw AuthFailure.secureStorage }
        saved.append(credentials)
        value = credentials
    }
    func clear() throws { value = nil }
}

@MainActor
final class TestAuthAPI: AuthServing {
    var user: AuthModels.UserInfo
    var exchangedToken: String?
    var verifiedTokens: [String] = []
    var revokedTokens: [String] = []
    var loginFailure: AuthFailure?
    var verifyFailure: AuthFailure?
    var refreshFailure: AuthFailure?
    var logoutFails = false
    var pauseRefresh = false
    var refreshCount = 0
    var refreshContinuation: CheckedContinuation<Void, Never>?
    init(user: AuthModels.UserInfo) { self.user = user }
    func login(firebaseIDToken: String) async throws -> AuthModels.LoginResponse {
        exchangedToken = firebaseIDToken
        if let loginFailure { throw loginFailure }
        return .init(jwtToken: "access", refreshToken: "refresh", user: user)
    }
    func verify(accessToken: String) async throws -> AuthModels.UserInfo {
        verifiedTokens.append(accessToken)
        if let verifyFailure { throw verifyFailure }
        return user
    }
    func refresh(refreshToken: String) async throws -> AuthModels.RefreshTokenResponse {
        refreshCount += 1
        if pauseRefresh { await withCheckedContinuation { refreshContinuation = $0 } }
        if let refreshFailure { throw refreshFailure }
        return .init(jwtToken: "rotated-access", refreshToken: "rotated-refresh", user: user)
    }
    func finishRefresh() {
        refreshContinuation?.resume()
        refreshContinuation = nil
    }
    func logout(refreshToken: String) async throws {
        revokedTokens.append(refreshToken)
        if logoutFails { throw AuthFailure.network }
    }
}
