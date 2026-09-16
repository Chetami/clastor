import Foundation
import Security

// Local persistence format, not an API contract. Never store a password here.
struct SessionCredentials: Codable, Equatable {
    let accessToken: String
    let refreshToken: String
    var refreshInProgress = false
}

@MainActor
protocol TokenStoring {
    func read() throws -> SessionCredentials?
    func save(_ credentials: SessionCredentials) throws
    func clear() throws
}

@MainActor
final class KeychainTokenStore: TokenStoring {
    private let service: String
    private let defaults: UserDefaults
    private var signedOutKey: String { "\(service).signedOut" }

    init(service: String, defaults: UserDefaults = .standard) {
        self.service = service
        self.defaults = defaults
    }

    private var query: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: service,
         kSecAttrAccount as String: "clastor-session",
         kSecAttrSynchronizable as String: false]
    }

    func read() throws -> SessionCredentials? {
        // Non-secret tombstone prevents restoration if a previous delete failed.
        guard !defaults.bool(forKey: signedOutKey) else { return nil }
        var query = query
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = item as? Data,
              let credentials = try? JSONDecoder().decode(SessionCredentials.self, from: data),
              !credentials.accessToken.isEmpty, !credentials.refreshToken.isEmpty else {
            throw AuthFailure.secureStorage
        }
        return credentials
    }

    func save(_ credentials: SessionCredentials) throws {
        let data = try JSONEncoder().encode(credentials)
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
        ]
        var status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            status = SecItemAdd(query.merging(attributes) { _, new in new } as CFDictionary, nil)
        }
        guard status == errSecSuccess else { throw AuthFailure.secureStorage }
        defaults.set(false, forKey: signedOutKey)
    }

    func clear() throws {
        defaults.set(true, forKey: signedOutKey)
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw AuthFailure.secureStorage }
    }
}
