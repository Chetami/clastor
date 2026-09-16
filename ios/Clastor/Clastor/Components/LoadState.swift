import SwiftUI

/// Shared load-state tracker for screens that fetch their own data
/// (detail screens, dashboard summaries). Centralises the cancellation and
/// error-mapping rules every view previously repeated:
/// - `CancellationError` / `AuthFailure.cancelled` are swallowed (leaving a
///   tab must not publish a late response)
/// - fatal failures surface via AuthFailure.message; quiet (`fatal: false`)
///   refreshes keep the previous data untouched.
@MainActor
@Observable
final class LoadState {
    private(set) var isLoading = false
    private(set) var isLoaded = false
    private(set) var failureMessage: String?

    var showsInitialProgress: Bool { isLoading && !isLoaded }

    @discardableResult
    func run(fatal: Bool = true, _ operation: () async throws -> Void) async -> Bool {
        guard !isLoading else { return false }
        isLoading = true
        if fatal { failureMessage = nil }
        defer { isLoading = false }
        do {
            try await operation()
            isLoaded = true
            return true
        } catch is CancellationError {
            return false
        } catch AuthFailure.cancelled {
            return false
        } catch {
            if fatal {
                failureMessage = AuthFailure.message(for: error)
            }
            return false
        }
    }
}

extension View {
    /// Standard overlay trio: initial progress, fatal error with retry, and
    /// (optionally) an empty state — all suppressed while content exists,
    /// matching the keep-previous-data behaviour of the web client.
    @ViewBuilder
    func loadStateOverlay(
        _ state: LoadState,
        hasContent: Bool,
        errorTitle: String,
        empty: (title: String, icon: String)? = nil,
        retry: @escaping () -> Void
    ) -> some View {
        overlay {
            if state.showsInitialProgress && !hasContent {
                ProgressView("Loading…")
            } else if let failure = state.failureMessage, !hasContent {
                ContentUnavailableView {
                    Label(errorTitle, systemImage: "exclamationmark.triangle")
                } description: {
                    Text(failure)
                } actions: {
                    Button("Try again", action: retry)
                        .buttonStyle(.borderedProminent)
                }
            } else if let empty, state.isLoaded, !hasContent {
                ContentUnavailableView(empty.title, systemImage: empty.icon)
            }
        }
    }
}
