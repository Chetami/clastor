import SwiftUI

/// Students list — search (name/email/subject), Active/Past/All filter, rate
/// and warning badges. Mirrors the web list minus CSV import.
struct StudentsView: View {
    let session: SessionStore

    @State private var api: any StudentsServing = StudentsAPI.live()
    @State private var students: [StudentModels.StudentResponse] = []
    @State private var isLoading = false
    @State private var hasLoaded = false
    @State private var message: String?
    @State private var search = ""
    @State private var statusFilter = "active"
    @State private var showCreate = false

    var body: some View {
        List {
            Section {
                Picker("Status", selection: $statusFilter) {
                    Text("Active").tag("active")
                    Text("Past").tag("past")
                    Text("All").tag("all")
                }
                .pickerStyle(.segmented)
                .listRowBackground(Color.clear)
                TextField("Search students", text: $search)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .accessibilityIdentifier("students.search")
            }
            ForEach(filteredStudents) { student in
                NavigationLink(value: StudentRoute(id: student.id)) {
                    StudentRow(student: student, subjects: sessionSubjects, currency: userCurrency)
                }
                .accessibilityIdentifier("students.row.\(student.id)")
            }
        }
        .navigationTitle("Students")
        .accessibilityIdentifier("students.list")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showCreate = true
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityIdentifier("students.add")
            }
        }
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
            } else if hasLoaded, students.isEmpty {
                ContentUnavailableView("No students", systemImage: "person.2",
                                        description: Text("There are no students to show for this account."))
                    .accessibilityIdentifier("students.empty")
            } else if hasLoaded, filteredStudents.isEmpty {
                ContentUnavailableView("No matches", systemImage: "magnifyingglass",
                                        description: Text("No students match your search."))
            }
        }
        .task {
            if !hasLoaded { await load() }
        }
        .refreshable { await load() }
        .onChange(of: showCreate) {
            if !showCreate { Task { await load(isFatal: false) } }
        }
        .sheet(isPresented: $showCreate) {
            StudentFormView(session: session) {
                Task { await load(isFatal: false) }
            }
        }
    }

    private var filteredStudents: [StudentModels.StudentResponse] {
        let statusMatches = students.filter { statusFilter == "all" || $0.status == statusFilter }
        let query = search.trimmingCharacters(in: .whitespaces).lowercased()
        guard !query.isEmpty else { return statusMatches.sorted { $0.name < $1.name } }
        return statusMatches
            .filter { student in
                if student.name.lowercased().contains(query) { return true }
                if let email = student.email, email.lowercased().contains(query) { return true }
                let subjectNames = student.subjectIds.compactMap { id in
                    sessionSubjects.first { $0.id == id }?.name.lowercased()
                }
                return subjectNames.contains { $0.contains(query) }
            }
            .sorted { $0.name < $1.name }
    }

    private var sessionSubjects: [AuthModels.Subject] {
        if case .signedIn(let user) = session.phase { return user.subjects ?? [] }
        return []
    }

    private var userCurrency: String {
        if case .signedIn(let user) = session.phase { return user.currency ?? "AUD" }
        return "AUD"
    }

    @MainActor
    private func load(isFatal: Bool = true) async {
        guard !isLoading else { return }
        isLoading = true
        if isFatal { message = nil }
        defer { isLoading = false }
        do {
            students = try await session.authenticated { token in
                try await api.list(accessToken: token)
            }
            hasLoaded = true
        } catch is CancellationError {
            // Leaving a tab or signing out must not publish a late response.
        } catch AuthFailure.cancelled {
        } catch {
            if isFatal {
                students = []
                hasLoaded = false
                message = AuthFailure.message(for: error)
            }
        }
    }
}

/// List row: avatar initials, name + status, subjects line, rate + frequency.
struct StudentRow: View {
    let student: StudentModels.StudentResponse
    let subjects: [AuthModels.Subject]
    let currency: String

    var body: some View {
        HStack(spacing: 12) {
            Text(StudentDerivations.initials(student.name))
                .font(.subheadline.weight(.semibold))
                .frame(width: 38, height: 38)
                .background(Color.accentColor.opacity(0.15), in: Circle())
                .foregroundStyle(Color.accentColor)
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(student.name)
                        .font(.subheadline.weight(.medium))
                    if student.status == "past" {
                        BadgeView(label: "Past", tone: .muted)
                    }
                }
                Text(subjectLine)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 3) {
                Text(StudentDerivations.formatRate(student.expectedAmount, rateType: student.rateType, currency: currency))
                    .font(.subheadline)
                Text(StudentDerivations.formatFrequency(student.frequencyPerWeek, rateType: student.rateType))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 2)
    }

    private var subjectLine: String {
        let names = student.subjectIds.compactMap { id in subjects.first { $0.id == id }?.name }
        return names.isEmpty ? "No subjects" : names.joined(separator: " · ")
    }
}
