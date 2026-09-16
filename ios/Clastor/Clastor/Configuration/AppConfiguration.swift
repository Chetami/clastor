import Foundation

struct AppConfiguration: Equatable {
    enum Environment: String {
        case dev, staging, prod

        var displayName: String {
            switch self {
            case .dev: "Clastor Dev"
            case .staging: "Clastor Staging"
            case .prod: "Clastor"
            }
        }

        var bundleIdentifier: String {
            switch self {
            case .dev: "dev.chethin.Clastor.dev"
            case .staging: "dev.chethin.Clastor.staging"
            case .prod: "dev.chethin.Clastor"
            }
        }
    }

    enum ConfigurationError: Error {
        case missingSetting(String)
        case invalidEnvironment
        case mismatchedBundleIdentifier
        case invalidAPIOrigin
    }

    let environment: Environment
    let apiBaseURL: URL
    let firebaseProjectID: String

    // An environment-specific namespace for the forthcoming token store.
    var keychainService: String { "\(environment.bundleIdentifier).auth.\(environment.rawValue)" }

    static func load(bundle: Bundle = .main) throws -> AppConfiguration {
        try load(info: bundle.infoDictionary ?? [:], bundleIdentifier: bundle.bundleIdentifier)
    }

    static func load(info: [String: Any], bundleIdentifier: String?) throws -> AppConfiguration {
        func setting(_ key: String) throws -> String {
            guard let value = info[key] as? String, !value.isEmpty,
                  !value.contains("$("), !value.contains("REPLACE_WITH") else {
                throw ConfigurationError.missingSetting(key)
            }
            return value
        }

        guard let environment = Environment(rawValue: try setting("AppEnvironment")) else {
            throw ConfigurationError.invalidEnvironment
        }
        guard bundleIdentifier == environment.bundleIdentifier else {
            throw ConfigurationError.mismatchedBundleIdentifier
        }
        let rawURL = try setting("APIBaseURL")
        guard let components = URLComponents(string: rawURL),
              let host = components.host, !host.isEmpty,
              components.user == nil, components.password == nil,
              components.query == nil, components.fragment == nil,
              components.path.isEmpty || components.path == "/",
              components.scheme == "https" ||
                (environment == .dev && components.scheme == "http" && host == "localhost"),
              let apiBaseURL = components.url else {
            throw ConfigurationError.invalidAPIOrigin
        }
        return AppConfiguration(
            environment: environment,
            apiBaseURL: apiBaseURL,
            firebaseProjectID: try setting("ExpectedFirebaseProjectID")
        )
    }
}
