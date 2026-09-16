import Foundation

enum AuthFailure: Error, Equatable {
    case invalidCredentials
    case disabledAccount
    case unauthorized
    case http(Int)
    case network
    case invalidResponse
    case secureStorage
    case interruptedRefresh
    case cancelled

    var message: String {
        switch self {
        case .invalidCredentials: "The email or password is incorrect."
        case .disabledAccount: "This account has been disabled."
        case .unauthorized: "Your session has expired. Please sign in again."
        case .http(403): "Your account does not have permission to do that."
        case .http(404): "This account is not set up in Clastor yet."
        case .http(429): "Too many attempts. Please wait a moment and try again."
        case .http: "Clastor is temporarily unavailable. Please try again."
        case .network: "Could not connect. Check your connection and try again."
        case .invalidResponse: "Could not read the server response. Please try again."
        case .secureStorage: "Could not access secure storage. Unlock your device and try again."
        case .interruptedRefresh: "Your session update was interrupted. Please sign in again."
        case .cancelled: "Sign-in was cancelled."
        }
    }

    static func message(for error: Error) -> String {
        (error as? AuthFailure)?.message ?? "Could not sign in. Please try again."
    }
}
