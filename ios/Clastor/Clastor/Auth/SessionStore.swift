import Foundation
import Observation

@MainActor
@Observable
final class SessionStore {
    enum Phase: Equatable {
        case restoring
        case signedOut
        case signingIn
        case signedIn(AuthModels.UserInfo)
        case retry
    }

    private(set) var phase: Phase = .restoring
    private(set) var message: String?
    let appName: String
    private let identity: any FirebaseSigningIn
    private let api: any AuthServing
    private let storage: any TokenStoring
    private var credentials: SessionCredentials?
    private var generation = 0
    private var started = false
    private var verification: Task<Void, Never>?

    init(appName: String, identity: any FirebaseSigningIn, api: any AuthServing, storage: any TokenStoring) {
        self.appName = appName
        self.identity = identity
        self.api = api
        self.storage = storage
    }

    static func live() -> SessionStore {
        #if DEBUG
        if AuthPreviewSupport.isUITesting || AuthPreviewSupport.isPreview {
            return AuthPreviewSupport.session()
        }
        #endif
        guard let configuration = try? AppConfiguration.load() else {
            preconditionFailure("App configuration is invalid. Check the selected scheme.")
        }
        return SessionStore(
            appName: configuration.environment.displayName,
            identity: FirebaseAuthService(),
            api: AuthAPI(origin: configuration.apiBaseURL),
            storage: KeychainTokenStore(service: configuration.keychainService)
        )
    }

    func restore() async {
        guard !started else { return }
        started = true
        await checkSession()
    }

    func signIn(email: String, password: String) async {
        guard phase == .signedOut else { return }
        let email = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !email.isEmpty, !password.isEmpty else {
            message = "Enter your email and password."
            return
        }
        generation += 1
        let current = generation
        phase = .signingIn
        message = nil
        do {
            let firebaseToken = try await identity.signIn(email: email, password: password)
            guard current == generation else { return }
            let response = try await api.login(firebaseIDToken: firebaseToken)
            guard current == generation else {
                revoke(response.refreshToken)
                return
            }
            do {
                try persist(access: response.jwtToken, refresh: response.refreshToken)
            } catch {
                revoke(response.refreshToken)
                throw error
            }
            phase = .signedIn(response.user)
        } catch {
            guard current == generation else { return }
            try? identity.signOut()
            phase = .signedOut
            message = AuthFailure.message(for: error)
        }
    }

    // Share verification and refresh across launch, foreground and manual retry.
    func checkSession() async {
        guard phase != .signingIn else { return }
        if let verification {
            await verification.value
            return
        }
        let current = generation
        let task = Task { await self.verifySession(generation: current) }
        verification = task
        await task.value
        if current == generation { verification = nil }
    }

    func becameActive() async {
        guard started, case .signedIn = phase else { return }
        await checkSession()
    }

    // Feature requests use the backend access token. A 401 shares the existing
    // verification/rotation task, then retries once with the current token.
    func authenticated<Value>(_ request: (String) async throws -> Value) async throws -> Value {
        try Task.checkCancellation()
        guard case .signedIn = phase, let stored = credentials else {
            throw AuthFailure.unauthorized
        }
        let current = generation
        do {
            let value = try await request(stored.accessToken)
            try requireCurrentSession(current)
            return value
        } catch AuthFailure.unauthorized {
            try requireCurrentSession(current)
            if credentials?.accessToken == stored.accessToken {
                await checkSession()
            }
            try requireCurrentSession(current)
            guard case .signedIn = phase, let refreshed = credentials else {
                throw AuthFailure.unauthorized
            }
            do {
                let value = try await request(refreshed.accessToken)
                try requireCurrentSession(current)
                return value
            } catch AuthFailure.unauthorized {
                try requireCurrentSession(current)
                signOut()
                message = AuthFailure.unauthorized.message
                throw AuthFailure.unauthorized
            }
        }
    }

    private func requireCurrentSession(_ expectedGeneration: Int) throws {
        try Task.checkCancellation()
        guard expectedGeneration == generation else { throw CancellationError() }
    }

    func signOut() {
        generation += 1
        verification?.cancel()
        verification = nil
        let token = credentials?.refreshToken
        credentials = nil
        phase = .signedOut
        message = nil
        do { try storage.clear() }
        catch { message = AuthFailure.secureStorage.message }
        // Firebase's currentUser alone never grants access to Clastor.
        do { try identity.signOut() }
        catch { message = "Signed out of Clastor. Restart the app if sign-in fails." }
        if let token { revoke(token) }
    }

    private func verifySession(generation current: Int) async {
        guard current == generation, !Task.isCancelled else { return }
        // Keep the tab hierarchy and in-flight feature requests alive during
        // foreground verification and successful token refresh.
        if case .signedIn = phase {} else { phase = .restoring }
        message = nil
        do {
            if credentials == nil { credentials = try storage.read() }
            guard let stored = credentials else {
                phase = .signedOut
                return
            }
            guard !stored.refreshInProgress else { throw AuthFailure.interruptedRefresh }
            do {
                let user = try await api.verify(accessToken: stored.accessToken)
                guard current == generation else { return }
                phase = .signedIn(user)
            } catch AuthFailure.unauthorized {
                guard current == generation else { return }
                try await rotate(stored, generation: current)
            }
        } catch {
            guard current == generation else { return }
            if error as? AuthFailure == .unauthorized || error as? AuthFailure == .interruptedRefresh {
                signOut()
                message = AuthFailure.message(for: error)
            } else {
                // Offline/5xx/429 during verification preserve credentials.
                phase = .retry
                message = AuthFailure.message(for: error)
            }
        }
    }

    private func rotate(_ stored: SessionCredentials, generation current: Int) async throws {
        // Persist before sending. A lost response or process termination must
        // never cause blind replay of a possibly consumed refresh token.
        var pending = stored
        pending.refreshInProgress = true
        try storage.save(pending)
        credentials = pending
        let response: AuthModels.RefreshTokenResponse
        do {
            response = try await api.refresh(refreshToken: stored.refreshToken)
        } catch {
            guard current == generation else { return }
            if error as? AuthFailure == .http(429) {
                // Rate limiting runs before token consumption on the backend.
                try storage.save(stored)
                credentials = stored
                throw error
            }
            if error as? AuthFailure == .unauthorized { throw error }
            throw AuthFailure.interruptedRefresh
        }
        guard current == generation else {
            revoke(response.refreshToken)
            return
        }
        do {
            try persist(access: response.jwtToken, refresh: response.refreshToken)
        } catch {
            revoke(response.refreshToken)
            throw AuthFailure.interruptedRefresh
        }
        phase = .signedIn(response.user)
    }

    private func persist(access: String, refresh: String) throws {
        guard !access.isEmpty, !refresh.isEmpty else { throw AuthFailure.invalidResponse }
        let next = SessionCredentials(accessToken: access, refreshToken: refresh)
        try storage.save(next)
        credentials = next
    }

    private func revoke(_ token: String) {
        let api = api
        Task { try? await api.logout(refreshToken: token) }
    }
}
