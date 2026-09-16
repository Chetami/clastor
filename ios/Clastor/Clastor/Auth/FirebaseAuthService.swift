import FirebaseAuth
import Foundation

@MainActor
protocol FirebaseSigningIn {
    func signIn(email: String, password: String) async throws -> String
    func signOut() throws
}

@MainActor
final class FirebaseAuthService: FirebaseSigningIn {
    func signIn(email: String, password: String) async throws -> String {
        do {
            let result = try await Auth.auth().signIn(withEmail: email, password: password)
            return try await result.user.getIDToken()
        } catch {
            // Do not display/log SDK errors: their metadata can contain credentials.
            switch AuthErrorCode(rawValue: (error as NSError).code) {
            case .invalidEmail, .invalidCredential, .wrongPassword, .userNotFound:
                throw AuthFailure.invalidCredentials
            case .userDisabled: throw AuthFailure.disabledAccount
            case .tooManyRequests: throw AuthFailure.http(429)
            case .networkError: throw AuthFailure.network
            default: throw AuthFailure.http(503)
            }
        }
    }

    func signOut() throws {
        try Auth.auth().signOut()
    }
}
