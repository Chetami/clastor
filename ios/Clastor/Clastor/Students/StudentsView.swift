import SwiftUI

struct StudentsView: View {
    let session: SessionStore
    @State private var api = StudentsAPI.live()
    @State private var students: [StudentModels.StudentResponse] = []
    @State private var isLoading = false
    @State private var hasLoaded = false
    @State private var message: String?

    var body: some View {
        List(students, id: \.id) { student in
            Text(student.name)
        }
        .listStyle(.plain)
        .accessibilityIdentifier("students.list")
        .overlay {
            if isLoading && students.isEmpty {
                ProgressView("Loading students…")
            } else if let message {
                ContentUnavailableView {
                    Label("Could not load students", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(message)
                } actions: {
                    Button("Try again") { Task { await load() } }
                        .buttonStyle(.borderedProminent)
                }
                .accessibilityIdentifier("students.error")
            } else if hasLoaded && students.isEmpty {
                ContentUnavailableView("No students", systemImage: "person.2",
                                       description: Text("There are no students to show for this account."))
                    .accessibilityIdentifier("students.empty")
            }
        }
        .navigationTitle("Students")
        .task {
            if !hasLoaded { await load() }
        }
        .refreshable { await load() }
    }

    @MainActor
    private func load() async {
        guard !isLoading else { return }
        isLoading = true
        message = nil
        defer { isLoading = false }
        do {
            let result = try await session.authenticated { token in
                try await api.list(accessToken: token)
            }
            try Task.checkCancellation()
            students = result
            hasLoaded = true
        } catch is CancellationError {
            // Leaving a tab or signing out must not publish a late response.
        } catch AuthFailure.cancelled {
        } catch {
            students = []
            hasLoaded = false
            message = AuthFailure.message(for: error)
        }
    }
}
