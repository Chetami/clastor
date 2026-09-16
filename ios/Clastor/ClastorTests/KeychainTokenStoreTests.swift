import Foundation
import Security
import Testing
@testable import Clastor

@MainActor
struct KeychainTokenStoreTests {
    @Test func tokensStayTogetherInAnIsolatedDeviceOnlyKeychainItem() throws {
        let service = "clastor.tests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: service)!
        defer { defaults.removePersistentDomain(forName: service) }
        let store = KeychainTokenStore(service: service, defaults: defaults)
        let other = KeychainTokenStore(service: service + ".staging", defaults: defaults)
        defer { try? store.clear(); try? other.clear() }
        let pair = SessionCredentials(accessToken: "test-access", refreshToken: "test-refresh")
        try store.save(pair)
        #expect(try store.read() == pair)
        #expect(try other.read() == nil)
        var result: CFTypeRef?
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                                    kSecAttrService as String: service,
                                    kSecReturnAttributes as String: true]
        #expect(SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess)
        let attributes = try #require(result as? [String: Any])
        #expect(attributes[kSecAttrAccessible as String] as? String == kSecAttrAccessibleWhenUnlockedThisDeviceOnly as String)
        #expect(attributes[kSecAttrSynchronizable as String] as? Bool != true)
        let rotated = SessionCredentials(accessToken: "next-access", refreshToken: "next-refresh")
        try store.save(rotated)
        #expect(try store.read() == rotated)
        try store.clear()
        #expect(try store.read() == nil)
        #expect(!defaults.dictionaryRepresentation().values.contains { String(describing: $0).contains("test-refresh") })
    }

    @Test func logoutTombstonePreventsRestoringAnUndeletedItem() throws {
        let service = "clastor.tests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: service)!
        defer { defaults.removePersistentDomain(forName: service) }
        let store = KeychainTokenStore(service: service, defaults: defaults)
        defer { try? store.clear() }
        try store.save(SessionCredentials(accessToken: "test-access", refreshToken: "test-refresh"))
        defaults.set(true, forKey: "\(service).signedOut")
        #expect(try store.read() == nil)
        try store.save(SessionCredentials(accessToken: "new-access", refreshToken: "new-refresh"))
        #expect(try store.read()?.accessToken == "new-access")
    }
}
