import SwiftUI

/// Student detail — profile, contact, billing (with live debt), stats rollup,
/// open invoices and notes. Mirrors the web detail page.
struct StudentDetailView: View {
    let session: SessionStore
    let studentID: String

    @Environment(LessonStore.self) private var lessonStore
    @Environment(InvoiceStore.self) private var invoiceStore
    @State private var studentsAPI: any StudentsServing = StudentsAPI.live()
    @State private var loadState = LoadState()
    @State private var student: StudentModels.StudentResponse?
    @State private var lessons: [LessonModels.LessonResponse] = []
    @State private var debt: Double?
    @State private var openInvoices: [PaymentModels.InvoiceResponse] = []
    @State private var showEdit = false
    @State private var notesDraft = ""
    @State private var notesInitialized = false
    @State private var isSavingNotes = false
    @State private var saveFailed = false
    @State private var saveFailureMessage: String?

    var body: some View {
        List {
            if let student {
                content(student)
            }
        }
        .navigationTitle(student?.name ?? "Student")
        .clastorScreen()
.navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Edit") { showEdit = true }
                    .disabled(student == nil)
            }
        }
        .loadStateOverlay(loadState, hasContent: student != nil, errorTitle: "Student not found") {
            Task { await load() }
        }
        .task {
            if student == nil { await load() }
        }
        .refreshable { await load(fatal: false) }
        .onChange(of: showEdit) {
            if !showEdit { Task { await load(fatal: false) } }
        }
        .sheet(isPresented: $showEdit) {
            if let student {
                StudentFormView(session: session, existing: student) {
                    Task { await load(fatal: false) }
                }
            }
        }
        .alert("Could not save", isPresented: $saveFailed) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(saveFailureMessage ?? "Please try again.")
        }
    }

    // MARK: Sections

    @ViewBuilder
    private func content(_ student: StudentModels.StudentResponse) -> some View {
        profileSection(student)
        contactSection(student)
        billingSection(student)
        statsSection(student)
        if !openInvoices.isEmpty {
            invoicesSection
        }
        notesSection(student)
        Section {
            Text("Added \(InvoiceDerivations.formatDate(student.createdAt)) · Updated \(InvoiceDerivations.formatDate(student.updatedAt))")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private func profileSection(_ student: StudentModels.StudentResponse) -> some View {
        Section {
            HStack(spacing: 12) {
                Text(StudentDerivations.initials(student.name))
                    .font(.title3.weight(.semibold))
                    .frame(width: 48, height: 48)
                    .background(Color.accentColor.opacity(0.15), in: Circle())
                    .foregroundStyle(Color.accentColor)
                VStack(alignment: .leading, spacing: 4) {
                    Text(student.name).font(.headline)
                    BadgeView(label: StudentDerivations.statusLabel(student.status),
                             tone: student.status == "active" ? .emerald : .muted)
                }
            }
            if !subjectNames(student).isEmpty {
                HStack(spacing: 6) {
                    ForEach(subjectNames(student), id: \.self) { name in
                        BadgeView(label: name, tone: .sky)
                    }
                }
            }
        }
        .accessibilityIdentifier("student.profile")
    }

    private func contactSection(_ student: StudentModels.StudentResponse) -> some View {
        Section("Contact") {
            if let email = student.email {
                LabeledContent("Email") {
                    Link(email, destination: mailto(email))
                }
            }
            if let phone = student.phone, !phone.isEmpty {
                LabeledContent("Phone") { Text(phone).textSelection(.enabled) }
            }
            if let parentEmail = student.parentEmail {
                LabeledContent("Parent email") {
                    Link(parentEmail, destination: mailto(parentEmail))
                }
            }
            if let timezone = student.timezone {
                LabeledContent("Timezone") { Text(timezone) }
            }
            LabeledContent("Frequency") {
                Text(StudentDerivations.formatFrequency(student.frequencyPerWeek, rateType: student.rateType))
            }
        }
    }

    private func mailto(_ email: String) -> URL {
        URL(string: "mailto:\(email)") ?? URL(string: "about:blank")!
    }

    private func billingSection(_ student: StudentModels.StudentResponse) -> some View {
        Section("Billing") {
            LabeledContent("Billing email") {
                VStack(alignment: .trailing) {
                    Text(student.billingEmail ?? "None set")
                    Text(StudentDerivations.billingEmailSourceLabel(student.billingEmailSource))
                        .font(.caption).foregroundStyle(.secondary)
                }
            }
            LabeledContent("Rate") {
                Text(StudentDerivations.formatRate(student.expectedAmount, rateType: student.rateType, currency: userCurrency))
            }
            LabeledContent("Expected / week") {
                Text(InvoiceDerivations.formatCurrency(student.expectedAmount * Double(student.frequencyPerWeek), currency: userCurrency))
            }
            LabeledContent("Owed") {
                if let debt {
                    Text(debt > 0
                         ? InvoiceDerivations.formatCurrency(debt, currency: userCurrency)
                         : "Nothing due")
                        .foregroundStyle(debt > 0 ? .red : .green)
                } else {
                    ProgressView()
                }
            }
        }
    }

    private func statsSection(_ student: StudentModels.StudentResponse) -> some View {
        let stats = StudentDerivations.computeStats(lessons)
        return Section("Last 6 months") {
            if stats.warning {
                Label("High no-show rate — missed \(Int((stats.noShowRate ?? 0) * 100))% of resolved lessons",
                      systemImage: "exclamationmark.triangle.fill")
                    .foregroundStyle(.orange)
                    .font(.footnote)
            }
            statsTileRow(stats)
        }
    }

    private func statsTileRow(_ stats: StudentDerivations.Stats) -> some View {
        HStack(spacing: 8) {
            statTile("Lessons", "\(stats.total)")
            statTile("Attended", "\(stats.attended)")
            statTile("No-shows", "\(stats.noShows)", warning: stats.noShows > 0)
            statTile("Disruptions", "\(stats.disruptions)", warning: stats.disruptions > 0)
            statTile("Upcoming", "\(stats.upcoming)")
        }
    }

    private func statTile(_ label: String, _ value: String, warning: Bool = false) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.headline)
                .foregroundStyle(warning ? .orange : .primary)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
        }
        .frame(maxWidth: .infinity)
    }

    private var invoicesSection: some View {
        Section("Open invoices") {
            ForEach(openInvoices) { invoice in
                HStack {
                    Text(invoice.invoiceNumber)
                        .font(.subheadline.weight(.medium))
                    Text("due \(InvoiceDerivations.formatDate(invoice.dueDate))")
                        .font(.caption).foregroundStyle(.secondary)
                    Spacer()
                    Text(InvoiceDerivations.formatCurrency(invoice.total, currency: invoice.currency))
                        .font(.subheadline)
                    BadgeView(label: InvoiceDerivations.statusLabel(invoice.status),
                             tone: PaymentsView.statusTone(invoice.status))
                }
            }
        }
    }

    private func notesSection(_ student: StudentModels.StudentResponse) -> some View {
        Section("Notes") {
            TextEditor(text: $notesDraft)
                .frame(minHeight: 70)
            if notesDraft != (student.notes ?? "") {
                HStack {
                    Button("Save") { Task { await saveNotes() } }
                        .disabled(isSavingNotes)
                    if isSavingNotes {
                        ProgressView()
                    }
                }
            }
        }
    }

    // MARK: Helpers

    private func subjectNames(_ student: StudentModels.StudentResponse) -> [String] {
        student.subjectIds.compactMap { id in sessionSubjects.first { $0.id == id }?.name }
    }

    private var sessionSubjects: [AuthModels.Subject] {
        if case .signedIn(let user) = session.phase { return user.subjects ?? [] }
        return []
    }

    private var userCurrency: String {
        if case .signedIn(let user) = session.phase { return user.currency ?? "AUD" }
        return "AUD"
    }

    // MARK: Data

    @MainActor
    private func load(fatal: Bool = true) async {
        await loadState.run(fatal: fatal) {
            let loadedStudent = try await session.authenticated { token in
                try await studentsAPI.student(id: studentID, accessToken: token)
            }
            try Task.checkCancellation()
            let studentId = loadedStudent.id
            async let lessonsResult = lessonStore.loadStudentLessons(studentId: studentId, session)
            async let debtResult = invoiceStore.loadStudentDebt(studentId: studentId, session)
            async let invoicesResult = invoiceStore.loadStudentInvoices(studentId: studentId, session)
            let (loadedLessons, loadedDebt, loadedInvoices) = try await (lessonsResult, debtResult, invoicesResult)
            try Task.checkCancellation()
            student = loadedStudent
            lessons = loadedLessons
            debt = loadedDebt
            openInvoices = loadedInvoices.filter { $0.status == "open" || $0.status == "overdue" }
            if !notesInitialized {
                notesDraft = loadedStudent.notes ?? ""
                notesInitialized = true
            }
        }
    }

    @MainActor
    private func saveNotes() async {
        guard let student, !isSavingNotes else { return }
        isSavingNotes = true
        defer { isSavingNotes = false }
        do {
            let notes = notesDraft.trimmingCharacters(in: .whitespacesAndNewlines)
            let updated = try await session.authenticated { token in
                try await studentsAPI.update(id: student.id,
                                             StudentModels.UpdateStudentRequest(notes: notes.isEmpty ? nil : notes),
                                             accessToken: token)
            }
            self.student = updated
        } catch {
            saveFailureMessage = AuthFailure.message(for: error)
            saveFailed = true
        }
    }
}
