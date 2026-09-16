import Foundation
import Observation

/// Shared student cache — the mobile counterpart of the web's
/// `["students"]` React Query cache. One list fetch shared by Home, Students,
/// Calendar, lesson forms and invoice creation; mutations upsert so every
/// surface stays fresh without manual reload wiring.
@MainActor
@Observable
final class StudentStore {
    private let api: any StudentsServing

    private(set) var students: [StudentModels.StudentResponse] = []
    private(set) var isLoaded = false
    private(set) var failureMessage: String?
    private var isLoading = false

    init() {
        // Default args evaluate nonisolated; a MainActor init body does not.
        self.api = StudentsAPI.live()
    }

    init(api: any StudentsServing) {
        self.api = api
    }

    var namesByID: [String: String] {
        Dictionary(students.map { ($0.id, $0.name) }, uniquingKeysWith: { first, _ in first })
    }

    func student(id: String) -> StudentModels.StudentResponse? {
        students.first { $0.id == id }
    }

    /// Fetch once; `force` re-fetches (pull-to-refresh, after sign-out/in).
    @discardableResult
    func loadIfNeeded(_ session: SessionStore, force: Bool = false) async -> [StudentModels.StudentResponse] {
        if isLoaded && !force { return students }
        guard !isLoading else { return students }
        isLoading = true
        defer { isLoading = false }
        do {
            students = try await session.authenticated { token in
                try await api.list(accessToken: token)
            }
            isLoaded = true
            failureMessage = nil
        } catch is CancellationError {
        } catch AuthFailure.cancelled {
        } catch {
            // Keep previously loaded students; only a failed first load surfaces.
            if !isLoaded { failureMessage = AuthFailure.message(for: error) }
        }
        return students
    }

    /// Upsert after create/edit so list screens update immediately.
    func apply(_ updated: StudentModels.StudentResponse) {
        if let index = students.firstIndex(where: { $0.id == updated.id }) {
            students[index] = updated
        } else {
            students.append(updated)
        }
    }

    /// Re-fetch on next load (e.g. the server derives fields at read time).
    func invalidate() {
        isLoaded = false
    }
}
