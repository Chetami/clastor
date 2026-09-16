import SwiftUI

/// Student create/edit form, mirroring the web's StudentForm: contact
/// fields, billing email auto/custom, subject multi-select from the tutor's
/// catalogue, rate + frequency, status and notes.
struct StudentFormView: View {
    let session: SessionStore
    var existing: StudentModels.StudentResponse?
    var onSaved: (() -> Void)?

    @Environment(\.dismiss) private var dismiss
    @State private var api: any StudentsServing = StudentsAPI.live()

    @State private var name = ""
    @State private var email = ""
    @State private var phone = ""
    @State private var parentEmail = ""
    @State private var billingMode = "auto"   // auto | custom
    @State private var billingEmail = ""
    @State private var selectedSubjectIDs: Set<String> = []
    @State private var rateType = "hourly"
    @State private var amountText = "0"
    @State private var frequencyText = "1"
    @State private var status = "active"
    @State private var notes = ""

    @State private var isSubmitting = false
    @State private var failed = false
    @State private var failureMessage: String?
    @State private var errorFields: Set<String> = []

    var body: some View {
        NavigationStack {
            Form {
                Section("Student") {
                    fieldRow("Name", text: $name, key: "name")
                        .accessibilityIdentifier("studentForm.name")
                    fieldRow("Email", text: $email, key: "email")
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    fieldRow("Phone", text: $phone, key: "phone")
                        .keyboardType(.phonePad)
                    fieldRow("Parent email", text: $parentEmail, key: "parentEmail")
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }

                Section {
                    Picker("Billing email", selection: $billingMode) {
                        Text("Auto").tag("auto")
                        Text("Custom").tag("custom")
                    }
                    if billingMode == "custom" {
                        fieldRow("Custom billing email", text: $billingEmail, key: "billingEmail")
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                    }
                } header: {
                    Text("Billing")
                } footer: {
                    if billingMode == "auto" {
                        if let resolved = StudentDerivations.resolveBillingEmail(explicit: nil, parentEmail: parentEmail, email: email) {
                            Text("Invoices will be sent to \(resolved)")
                        } else {
                            Text("No billing email set — add a parent or student email.")
                        }
                    }
                }

                Section {
                    if sessionSubjects.isEmpty {
                        Text("Add subjects in Settings first.")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(sessionSubjects, id: \.id) { subject in
                            Button {
                                toggleSubject(subject.id)
                            } label: {
                                HStack {
                                    Text(subject.name)
                                        .foregroundStyle(.primary)
                                    Spacer()
                                    if selectedSubjectIDs.contains(subject.id) {
                                        Image(systemName: "checkmark")
                                            .foregroundStyle(Color.accentColor)
                                    }
                                }
                            }
                        }
                    }
                } header: {
                    Text("Subjects")
                } footer: {
                    if errorFields.contains("subjects") {
                        Text("Select at least one subject").foregroundStyle(.red)
                    }
                }

                Section("Rate") {
                    Picker("Rate type", selection: $rateType) {
                        Text("Hourly").tag("hourly")
                        Text("Per Lesson").tag("per_lesson")
                    }
                    fieldRow(rateType == "hourly" ? "Hourly rate" : "Per-lesson rate",
                             text: $amountText, key: "amount")
                        .keyboardType(.decimalPad)
                    fieldRow(rateType == "hourly" ? "Expected hours / week" : "Expected lessons / week",
                             text: $frequencyText, key: "frequency")
                        .keyboardType(.numberPad)
                }

                Section("Additional details") {
                    Picker("Status", selection: $status) {
                        Text("Active").tag("active")
                        Text("Past").tag("past")
                    }
                    .pickerStyle(.segmented)
                    TextField("Notes", text: $notes, axis: .vertical)
                }
            }
            .navigationTitle(existing == nil ? "New student" : "Edit student")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { Task { await submit() } }
                        .disabled(isSubmitting)
                }
            }
            .onAppear { seedFromExisting() }
            .alert(existing == nil ? "Could not create student" : "Could not save student",
                   isPresented: $failed) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(failureMessage ?? "Please check the form and try again.")
            }
        }
    }

    // MARK: Rows

    private func fieldRow(_ label: String, text: Binding<String>, key: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            LabeledContent(label) {
                TextField(label, text: text)
                    .multilineTextAlignment(.trailing)
            }
            if errorFields.contains(key) {
                Text(fieldError(key))
                    .font(.caption)
                    .foregroundStyle(.red)
            }
        }
    }

    private func fieldError(_ key: String) -> String {
        switch key {
        case "name": return "Name is required"
        case "email", "parentEmail", "billingEmail": return "Enter a valid email"
        default: return "Enter a valid number"
        }
    }

    // MARK: Subjects

    private var sessionSubjects: [AuthModels.Subject] {
        if case .signedIn(let user) = session.phase { return user.subjects ?? [] }
        return []
    }

    private func toggleSubject(_ id: String) {
        if selectedSubjectIDs.contains(id) {
            selectedSubjectIDs.remove(id)
        } else {
            selectedSubjectIDs.insert(id)
        }
        errorFields.remove("subjects")
    }

    // MARK: Seed

    private func seedFromExisting() {
        guard let existing, name.isEmpty else { return }
        name = existing.name
        email = existing.email ?? ""
        phone = existing.phone ?? ""
        parentEmail = existing.parentEmail ?? ""
        billingMode = existing.billingEmailSource == "explicit" ? "custom" : "auto"
        billingEmail = existing.billingEmailSource == "explicit" ? (existing.billingEmail ?? "") : ""
        selectedSubjectIDs = Set(existing.subjectIds)
        rateType = existing.rateType
        amountText = existing.expectedAmount == existing.expectedAmount.rounded()
            ? String(Int(existing.expectedAmount))
            : String(existing.expectedAmount)
        frequencyText = String(existing.frequencyPerWeek)
        status = existing.status
        notes = existing.notes ?? ""
    }

    // MARK: Validation + submit

    private func trimmed(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespaces)
    }

    private func isValidEmail(_ value: String) -> Bool {
        guard let at = value.firstIndex(of: "@"),
              at != value.startIndex,
              let dot = value.lastIndex(of: "."),
              dot > at,
              value.distance(from: at, to: dot) > 1
        else { return false }
        return true
    }

    private func validate() -> Bool {
        var errors: Set<String> = []
        if trimmed(name).isEmpty { errors.insert("name") }
        for (value, key) in [(trimmed(email), "email"),
                             (trimmed(parentEmail), "parentEmail"),
                             (billingMode == "custom" ? trimmed(billingEmail) : "", "billingEmail")] {
            if !value.isEmpty && !isValidEmail(value) { errors.insert(key) }
        }
        if selectedSubjectIDs.isEmpty { errors.insert("subjects") }
        if Double(amountText) == nil { errors.insert("amount") }
        if Int(frequencyText) == nil { errors.insert("frequency") }
        errorFields = errors
        return errors.isEmpty
    }

    @MainActor
    private func submit() async {
        guard !isSubmitting, validate() else { return }
        isSubmitting = true
        defer { isSubmitting = false }
        do {
            let name = trimmed(name)
            let email = trimmed(email)
            let phone = trimmed(phone)
            let parentEmail = trimmed(parentEmail)
            let customBilling = billingMode == "custom" ? trimmed(billingEmail) : ""
            let notes = trimmed(notes)
            if let existing {
                _ = try await session.authenticated { token in
                    try await api.update(
                        id: existing.id,
                        StudentModels.UpdateStudentRequest(
                            name: name,
                            email: email.isEmpty ? nil : email,
                            phone: phone.isEmpty ? nil : phone,
                            parentEmail: parentEmail.isEmpty ? nil : parentEmail,
                            billingEmail: customBilling.isEmpty ? nil : customBilling,
                            subjectIds: Array(selectedSubjectIDs),
                            expectedAmount: Double(amountText) ?? 0,
                            rateType: rateType,
                            frequencyPerWeek: Int(frequencyText) ?? 0,
                            status: status,
                            timezone: nil,
                            notes: notes.isEmpty ? nil : notes),
                        accessToken: token)
                }
            } else {
                _ = try await session.authenticated { token in
                    try await api.create(
                        StudentModels.CreateStudentRequest(
                            name: name,
                            email: email.isEmpty ? nil : email,
                            phone: phone.isEmpty ? nil : phone,
                            parentEmail: parentEmail.isEmpty ? nil : parentEmail,
                            billingEmail: customBilling.isEmpty ? nil : customBilling,
                            subjectIds: Array(selectedSubjectIDs),
                            expectedAmount: Double(amountText) ?? 0,
                            rateType: rateType,
                            frequencyPerWeek: Int(frequencyText) ?? 0,
                            status: status,
                            timezone: nil,
                            notes: notes.isEmpty ? nil : notes),
                        accessToken: token)
                }
            }
            onSaved?()
            dismiss()
        } catch is CancellationError {
        } catch AuthFailure.cancelled {
        } catch {
            failureMessage = AuthFailure.message(for: error)
            failed = true
        }
    }
}
