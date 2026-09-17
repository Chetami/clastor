import SwiftUI

/// Profile & settings — account (name, currency, timezone), the subject
/// catalogue (which student forms read from), email verification status and
/// sign out. Mirrors the web's account settings for the mobile-critical
/// subset; saves PATCH /api/users/me and refresh the session user.
struct ProfileView: View {
    let session: SessionStore

    @State private var api: any UserServing = ProfileAPI.live()

    // Account drafts (saved together)
    @State private var nameDraft = ""
    @State private var currencyDraft = "AUD"
    @State private var timezoneDraft: String?
    @State private var initialized = false

    // Subject editing
    @State private var editingSubject: AuthModels.Subject?
    @State private var newSubjectName = ""
    @State private var showAddSubject = false

    @State private var isSaving = false
    @State private var saveFailed = false
    @State private var failureMessage: String?

    private static let currencyOptions: [(code: String, label: String)] = [
        ("AUD", "AUD — Australian Dollar"),
        ("USD", "USD — US Dollar"),
        ("EUR", "EUR — Euro"),
        ("GBP", "GBP — British Pound"),
        ("NZD", "NZD — New Zealand Dollar"),
        ("CAD", "CAD — Canadian Dollar"),
        ("SGD", "SGD — Singapore Dollar"),
        ("HKD", "HKD — Hong Kong Dollar"),
        ("INR", "INR — Indian Rupee"),
        ("ZAR", "ZAR — South African Rand"),
        ("AED", "AED — UAE Dirham"),
    ]

    var body: some View {
        Form {
            profileHeader
            accountSection
            subjectsSection
            Section {
                Button("Sign out", role: .destructive, action: session.signOut)
                    .accessibilityIdentifier("account.signOut")
            }
        }
        .navigationTitle("Profile")
        .clastorScreen()
        .toolbar {
            if accountIsDirty {
                ToolbarItem(placement: .confirmationAction) {
                    if isSaving {
                        ProgressView()
                    } else {
                        Button("Save") { Task { await saveAccount() } }
                            .accessibilityIdentifier("profile.save")
                    }
                }
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    newSubjectName = ""
                    showAddSubject = true
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityIdentifier("profile.addSubject")
            }
        }
        .onAppear { seedDrafts() }
        .alert("Add subject", isPresented: $showAddSubject) {
            TextField("Subject name", text: $newSubjectName)
            Button("Add") { Task { await addSubject() } }
            Button("Cancel", role: .cancel) {}
        }
        .alert("Rename subject", isPresented: Binding(
            get: { editingSubject != nil },
            set: { if !$0 { editingSubject = nil } }
        )) {
            TextField("Subject name", text: $newSubjectName)
            Button("Save") { Task { await renameSubject() } }
            Button("Cancel", role: .cancel) { editingSubject = nil }
        }
        .alert("Could not save", isPresented: $saveFailed) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(failureMessage ?? "Please try again.")
        }
    }

    // MARK: Header

    /// Native settings-style header: avatar initials, name, email + status.
    private var profileHeader: some View {
        Section {
            HStack(spacing: 14) {
                Text(avatarInitials)
                    .font(.title2.weight(.semibold))
                    .frame(width: 56, height: 56)
                    .background(Color.accentColor.opacity(0.15), in: Circle())
                    .foregroundStyle(Color.accentColor)
                VStack(alignment: .leading, spacing: 3) {
                    Text(user?.name ?? "Your account")
                        .font(.headline)
                    if let user {
                        Text(user.email)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                        Label(user.emailVerified == true ? "Verified" : "Not verified",
                              systemImage: user.emailVerified == true ? "checkmark.seal.fill" : "exclamationmark.triangle.fill")
                            .font(.caption2)
                            .foregroundStyle(user.emailVerified == true ? .green : .orange)
                    }
                }
            }
            .listRowBackground(Color.clear)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 4)
        }
    }

    private var avatarInitials: String {
        guard let name = user?.name, !name.isEmpty else { return "–" }
        let parts = name.split(separator: " ").prefix(2)
        return parts.compactMap { $0.first }.map(String.init).joined()
    }

    // MARK: Account

    private var accountSection: some View {
        Section("Account") {
            LabeledContent("Name") {
                TextField("Name", text: $nameDraft)
                    .multilineTextAlignment(.trailing)
            }
            Picker("Currency", selection: $currencyDraft) {
                ForEach(Self.currencyOptions, id: \.code) { option in
                    Text(option.label).tag(option.code)
                }
            }
            NavigationLink {
                TimezonePickerView(selection: $timezoneDraft)
            } label: {
                LabeledContent("Timezone") {
                    Text(timezoneDraft ?? "Not set").foregroundStyle(.secondary)
                }
            }
        }
    }

    // MARK: Subjects

    private var subjectsSection: some View {
        Section {
            let subjects = sessionSubjects
            if subjects.isEmpty {
                Text("No subjects yet. Tap + to add your first subject — students are tagged against this list.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(subjects, id: \.id) { subject in
                    Button {
                        editingSubject = subject
                        newSubjectName = subject.name
                    } label: {
                        HStack {
                            Text(subject.name)
                                .foregroundStyle(.primary)
                            Spacer()
                            Image(systemName: "pencil")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .accessibilityIdentifier("profile.subject.\(subject.id)")
                }
                .onDelete { offsets in
                    Task { await deleteSubjects(at: offsets) }
                }
            }
        } header: {
            Text("Subjects")
        } footer: {
            Text("Your catalogue — used when creating students and lessons. Tap to rename.")
        }
    }

    private var sessionSubjects: [AuthModels.Subject] {
        if case .signedIn(let user) = session.phase { return user.subjects ?? [] }
        return []
    }

    private var user: AuthModels.UserInfo? {
        if case .signedIn(let user) = session.phase { return user }
        return nil
    }

    // MARK: Drafts & saving

    private func seedDrafts() {
        guard !initialized, let user else { return }
        nameDraft = user.name ?? ""
        currencyDraft = user.currency ?? "AUD"
        timezoneDraft = user.timezone
        initialized = true
    }

    private var accountIsDirty: Bool {
        guard let user else { return false }
        return nameDraft != (user.name ?? "")
            || currencyDraft != (user.currency ?? "AUD")
            || timezoneDraft != user.timezone
    }

    @MainActor
    private func saveAccount() async {
        guard !isSaving else { return }
        isSaving = true
        defer { isSaving = false }
        do {
            let name = nameDraft.trimmingCharacters(in: .whitespaces)
            _ = try await session.authenticated { token in
                try await api.updateMe(
                    AuthModels.UpdateUserRequest(
                        name: name.isEmpty ? nil : name,
                        currency: currencyDraft,
                        timezone: timezoneDraft),
                    accessToken: token)
            }
            await session.checkSession()
        } catch is CancellationError {
        } catch AuthFailure.cancelled {
        } catch {
            failureMessage = AuthFailure.message(for: error)
            saveFailed = true
        }
    }

    // MARK: Subject mutations (full-array replacement, like the web)

    /// Mirrors shared/lib/subjects.ts generateSubjectId().
    private func generateSubjectId() -> String {
        let random = UUID().uuidString.lowercased().replacingOccurrences(of: "-", with: "").prefix(8)
        let stamp = String(Int(Date().timeIntervalSince1970 * 1000), radix: 36)
        return "subj_\(random)\(stamp)"
    }

    @MainActor
    private func saveSubjects(_ subjects: [AuthModels.Subject]) async {
        do {
            _ = try await session.authenticated { token in
                try await api.updateMe(AuthModels.UpdateUserRequest(subjects: subjects), accessToken: token)
            }
            await session.checkSession()
        } catch is CancellationError {
        } catch AuthFailure.cancelled {
        } catch {
            failureMessage = AuthFailure.message(for: error)
            saveFailed = true
        }
    }

    @MainActor
    private func addSubject() async {
        let name = newSubjectName.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty else { return }
        var subjects = sessionSubjects
        guard !subjects.contains(where: { $0.name.lowercased() == name.lowercased() }) else { return }
        subjects.append(AuthModels.Subject(id: generateSubjectId(), name: name, color: nil))
        await saveSubjects(subjects)
    }

    @MainActor
    private func renameSubject() async {
        guard let subject = editingSubject else { return }
        let name = newSubjectName.trimmingCharacters(in: .whitespaces)
        editingSubject = nil
        guard !name.isEmpty else { return }
        let subjects = sessionSubjects.map { current in
            current.id == subject.id ? AuthModels.Subject(id: current.id, name: name, color: current.color) : current
        }
        await saveSubjects(subjects)
    }

    @MainActor
    private func deleteSubjects(at offsets: IndexSet) async {
        let subjects = sessionSubjects
        // Students tagged with a removed subject keep their ids; re-adding a
        // subject with a fresh id is the recovery path (same on the web).
        await saveSubjects(subjects.removing(atOffsets: offsets))
    }
}

private extension Array {
    func removing(atOffsets offsets: IndexSet) -> [Element] {
        var copy = self
        copy.remove(atOffsets: offsets)
        return copy
    }
}

/// Searchable IANA timezone picker (the web's TimezoneSelect counterpart).
/// The device's local zone is pinned to the top.
struct TimezonePickerView: View {
    @Binding var selection: String?
    @State private var search = ""
    @Environment(\.dismiss) private var dismiss

    private var zones: [String] {
        TimeZone.knownTimeZoneIdentifiers.sorted()
    }

    private var filtered: [String] {
        let query = search.trimmingCharacters(in: .whitespaces).lowercased()
        guard !query.isEmpty else { return zones }
        return zones.filter { $0.lowercased().contains(query) }
    }

    var body: some View {
        List {
            let local = TimeZone.current.identifier
            Button {
                selection = local
                dismiss()
            } label: {
                HStack {
                    Text("\(local) (this device)")
                    Spacer()
                    if selection == local {
                        Image(systemName: "checkmark").foregroundStyle(Color.accentColor)
                    }
                }
            }
            ForEach(filtered, id: \.self) { zone in
                Button {
                    selection = zone
                    dismiss()
                } label: {
                    HStack {
                        Text(zone).foregroundStyle(.primary)
                        Spacer()
                        if selection == zone {
                            Image(systemName: "checkmark").foregroundStyle(Color.accentColor)
                        }
                    }
                }
            }
        }
        .searchable(text: $search)
        .navigationTitle("Timezone")
        .clastorScreen()
.navigationBarTitleDisplayMode(.inline)
    }
}
