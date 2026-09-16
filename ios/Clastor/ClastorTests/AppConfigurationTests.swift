import Foundation
import Testing
@testable import Clastor

@MainActor
struct AppConfigurationTests {
    private func info(environment: String = "dev", url: String = "https://api.example.test") -> [String: Any] {
        [
            "AppEnvironment": environment,
            "APIBaseURL": url,
            "ExpectedFirebaseProjectID": "test-project",
        ]
    }

    @Test func environmentsUseDistinctIdentitiesAndStorage() throws {
        let configurations = try ["dev", "staging", "prod"].map { environment in
            let bundle = "dev.chethin.Clastor" + (environment == "prod" ? "" : ".\(environment)")
            return try AppConfiguration.load(info: info(environment: environment), bundleIdentifier: bundle)
        }
        #expect(Set(configurations.map(\.keychainService)).count == 3)
        #expect(configurations.map(\.environment.displayName) == ["Clastor Dev", "Clastor Staging", "Clastor"])
    }

    @Test func onlyDevAllowsLocalHTTP() throws {
        let configuration = try AppConfiguration.load(
            info: info(url: "http://localhost:3001"), bundleIdentifier: "dev.chethin.Clastor.dev"
        )
        #expect(configuration.apiBaseURL.absoluteString == "http://localhost:3001")
        for environment in ["staging", "prod"] {
            let bundle = "dev.chethin.Clastor" + (environment == "prod" ? "" : ".staging")
            #expect(throws: AppConfiguration.ConfigurationError.self) {
                try AppConfiguration.load(info: info(environment: environment, url: "http://localhost:3001"), bundleIdentifier: bundle)
            }
        }
    }

    @Test func differentBackendsCannotReuseStoredCredentials() throws {
        let first = try AppConfiguration.load(info: info(), bundleIdentifier: "dev.chethin.Clastor.dev")
        let second = try AppConfiguration.load(info: info(url: "https://another.example.test"), bundleIdentifier: "dev.chethin.Clastor.dev")
        var otherProject = info()
        otherProject["ExpectedFirebaseProjectID"] = "another-project"
        let third = try AppConfiguration.load(info: otherProject, bundleIdentifier: "dev.chethin.Clastor.dev")
        #expect(Set([first.keychainService, second.keychainService, third.keychainService]).count == 3)
    }

    @Test(arguments: [
        "http://api.example.test", "https://user:password@api.example.test",
        "https://api.example.test?token=value", "https://api.example.test#fragment",
        "https://api.example.test/api", "not-a-url", "https://",
    ])
    func rejectsUnsafeOrAmbiguousAPIOrigins(url: String) {
        #expect(throws: AppConfiguration.ConfigurationError.self) {
            try AppConfiguration.load(info: info(url: url), bundleIdentifier: "dev.chethin.Clastor.dev")
        }
    }

    @Test func rejectsAnEnvironmentBundleMismatch() {
        #expect(throws: AppConfiguration.ConfigurationError.self) {
            try AppConfiguration.load(info: info(environment: "staging"), bundleIdentifier: "dev.chethin.Clastor.dev")
        }
    }

    @Test func rejectsMissingOrUnexpandedSettings() {
        for key in ["AppEnvironment", "APIBaseURL", "ExpectedFirebaseProjectID"] {
            for value in ["", "$(" + key + ")", "REPLACE_WITH_VALUE"] {
                var settings = info()
                settings[key] = value
                #expect(throws: AppConfiguration.ConfigurationError.self) {
                    try AppConfiguration.load(info: settings, bundleIdentifier: "dev.chethin.Clastor.dev")
                }
            }
        }
    }
}
