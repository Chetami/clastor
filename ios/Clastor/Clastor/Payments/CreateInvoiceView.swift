import SwiftUI

/// Create-invoice sheet — student → unpaid lessons → editable line review →
/// details, mirroring the web's 3-step wizard in a single form.
struct CreateInvoiceView: View {
    let session: SessionStore
    var preselectedStudent: StudentModels.StudentResponse?
    var preselectedLessonID: String?
    var onCreated: (() -> Void)?

    @Environment(\.dismiss) private var dismiss
    @Environment(StudentStore.self) private var studentStore
    @Environment(LessonStore.self) private var lessonStore
    @Environment(InvoiceStore.self) private var invoiceStore

    @State private var students: [StudentModels.StudentResponse] = []
    @State private var studentID = ""
    @State private var unpaidLessons: [LessonModels.LessonResponse] = []
    @State private var isLoadingLessons = false
    @State private var lessonsLoaded = false
    @State private var selectedLessonIDs: Set<String> = []
    @State private var quantityTexts: [String: String] = [:]
    @State private var amountTexts: [String: String] = [:]
    @State private var billingEmailOverride = ""
    @State private var dueDate = InvoiceDerivations.defaultDueDate()
    @State private var paymentMethod = "bank_transfer"
    @State private var notes = ""
    @State private var isSubmitting = false
    @State private var failed = false
    @State private var failureMessage: String?
    @State private var sendTarget: PaymentModels.InvoiceResponse?

    private var selectedStudent: StudentModels.StudentResponse? {
        studentStore.students.first { $0.id == studentID } ?? students.first { $0.id == studentID }
    }

    var body: some View {
        NavigationStack {
            Form {
                if preselectedStudent == nil {
                    Section("Student") {
                        Picker("Student", selection: $studentID) {
                            Text("Select…").tag("")
                            ForEach(students) { student in
                                Text(student.name).tag(student.id)
                            }
                        }
                    }
                }
                if let student = selectedStudent {
                    lessonsSection(student)
                    if !selectedLessonIDs.isEmpty {
                        reviewSection(student)
                        detailsSection(student)
                    }
                }
            }
            .navigationTitle("New invoice")
            .clastorScreen()
.navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Menu {
                        Button("Create & Send") { Task { await submit(status: "open", send: true) } }
                        Button("Create only") { Task { await submit(status: "open", send: false) } }
                        Button("Save as Draft") { Task { await submit(status: "draft", send: false) } }
                    } label: {
                        if isSubmitting {
                            ProgressView()
                        } else {
                            Text("Create")
                        }
                    }
                    .disabled(selectedLessonIDs.isEmpty || isSubmitting)
                }
            }
            .task { await prepare() }
            .onChange(of: studentID) {
                // A different student means a different unpaid-lesson set —
                // clear selections and per-line overrides before reloading.
                selectedLessonIDs.removeAll()
                quantityTexts.removeAll()
                amountTexts.removeAll()
                Task { await loadLessons() }
            }
            .sheet(item: $sendTarget) { invoice in
                EmailComposeSheet(
                    title: "Send invoice",
                    sendLabel: "Send email",
                    fetchPreview: { message in
                        try await invoiceStore.sendPreview(id: invoice.id, message: message, session)
                    },
                    send: { message in
                        _ = try await invoiceStore.send(id: invoice.id, message: message, session)
                    },
                    onSent: {
                        onCreated?()
                        dismiss()
                    }
                )
            }
            .alert("Could not create invoice", isPresented: $failed) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(failureMessage ?? "Please try again.")
            }
        }
    }

    // MARK: Sections

    private func lessonsSection(_ student: StudentModels.StudentResponse) -> some View {
        Section {
            if isLoadingLessons {
                HStack { Spacer(); ProgressView(); Spacer() }
            } else {
                let partitions = InvoiceDerivations.partitionInvoiceableLessons(unpaidLessons)
                lessonGroup("Ready to invoice", partitions.chargeable)
                lessonGroup("Not recorded", partitions.unrecorded)
                if !partitions.upcoming.isEmpty {
                    lessonGroup("Prepay upcoming lessons", partitions.upcoming)
                }
                if partitions.chargeable.isEmpty && partitions.unrecorded.isEmpty && partitions.upcoming.isEmpty {
                    Text("No unpaid lessons for this student.")
                        .foregroundStyle(.secondary)
                }
            }
        } header: {
            Text("Lessons")
        } footer: {
            Text("Rate: \(rateLine(student))")
        }
    }

    private func lessonGroup(_ title: String, _ lessons: [LessonModels.LessonResponse]) -> some View {
        Group {
            if !lessons.isEmpty {
                Text(title)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .padding(.top, 4)
                ForEach(lessons) { lesson in
                    Button {
                        toggle(lesson)
                    } label: {
                        HStack {
                            Image(systemName: selectedLessonIDs.contains(lesson.id) ? "checkmark.circle.fill" : "circle")
                                .foregroundStyle(selectedLessonIDs.contains(lesson.id) ? Color.accentColor : .secondary)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(lesson.subject ?? "Lesson")
                                Text("\(InvoiceDerivations.formatDate(lesson.startDateTime)) · \(lesson.durationMinutes) min")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            if let badge = LessonDerivations.lessonStatusBadge(lesson) {
                                BadgeView(label: badge.label, tone: badge.tone)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func reviewSection(_ student: StudentModels.StudentResponse) -> some View {
        Section {
            ForEach(selectedLessons) { lesson in
                lineRow(lesson, student)
            }
            LabeledContent("Total") {
                Text(InvoiceDerivations.formatCurrency(total(student), currency: userCurrency))
                    .font(.body.weight(.semibold))
            }
        } header: {
            Text("Line items")
        }
    }

    private func lineRow(_ lesson: LessonModels.LessonResponse, _ student: StudentModels.StudentResponse) -> some View {
        let base = InvoiceDerivations.buildLessonLineItem(lesson, rateType: student.rateType, expectedAmount: student.expectedAmount)
        let quantity = Double(quantityTexts[lesson.id] ?? "") ?? base.quantity
        let unit = Double(amountTexts[lesson.id] ?? "") ?? base.unitAmount
        return VStack(alignment: .leading, spacing: 6) {
            Text(base.description)
                .font(.footnote)
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(student.rateType == "hourly" ? "Hours" : "Qty").font(.caption2).foregroundStyle(.secondary)
                    TextField("Qty", text: binding(for: lesson.id, texts: $quantityTexts, fallback: base.quantity))
                        .keyboardType(.decimalPad)
                        .frame(width: 70)
                        .textFieldStyle(.roundedBorder)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text("Rate").font(.caption2).foregroundStyle(.secondary)
                    TextField("Rate", text: binding(for: lesson.id, texts: $amountTexts, fallback: base.unitAmount))
                        .keyboardType(.decimalPad)
                        .frame(width: 90)
                        .textFieldStyle(.roundedBorder)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text("Amount").font(.caption2).foregroundStyle(.secondary)
                    Text(InvoiceDerivations.formatCurrency(InvoiceDerivations.roundLineAmount(unitAmount: unit, quantity: quantity), currency: userCurrency))
                        .font(.body.weight(.medium))
                }
            }
        }
        .padding(.vertical, 2)
    }

    private func detailsSection(_ student: StudentModels.StudentResponse) -> some View {
        Section {
            TextField("Billing email", text: $billingEmailOverride)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
            DatePicker("Due", selection: $dueDate, displayedComponents: .date)
            Picker("Payment method", selection: $paymentMethod) {
                Text("Bank Transfer").tag("bank_transfer")
                Text("Cash").tag("cash")
                Text("Stripe").tag("stripe")
            }
            TextField("Notes", text: $notes, axis: .vertical)
        } header: {
            Text("Details")
        } footer: {
            if billingEmailOverride.trimmingCharacters(in: .whitespaces).isEmpty {
                Text("Billing email defaults to the student's: \(student.billingEmail ?? "none set")")
            }
        }
    }

    // MARK: Helpers

    private var selectedLessons: [LessonModels.LessonResponse] {
        unpaidLessons.filter { selectedLessonIDs.contains($0.id) }
    }

    private func binding(for id: String, texts: Binding<[String: String]>, fallback: Double) -> Binding<String> {
        Binding(
            get: { texts.wrappedValue[id] ?? formatNumber(fallback) },
            set: { texts.wrappedValue[id] = $0 }
        )
    }

    private func formatNumber(_ value: Double) -> String {
        value == value.rounded() && abs(value) < 1000 ? String(Int(value)) : String(format: "%.2f", value)
    }

    private func lineItemBodies(_ student: StudentModels.StudentResponse) -> [CreateInvoiceLineItemBody] {
        selectedLessons.map { lesson in
            let base = InvoiceDerivations.buildLessonLineItem(lesson, rateType: student.rateType, expectedAmount: student.expectedAmount)
            let quantity = Double(quantityTexts[lesson.id] ?? "") ?? base.quantity
            let unit = Double(amountTexts[lesson.id] ?? "") ?? base.unitAmount
            return CreateInvoiceLineItemBody(
                lessonId: lesson.id, description: base.description,
                durationMinutes: base.durationMinutes, rateType: base.rateType,
                unitAmount: unit, quantity: quantity)
        }
    }

    private func total(_ student: StudentModels.StudentResponse) -> Double {
        InvoiceDerivations.lineItemsSubtotal(lineItemBodies(student))
    }

    private func toggle(_ lesson: LessonModels.LessonResponse) {
        if selectedLessonIDs.contains(lesson.id) {
            selectedLessonIDs.remove(lesson.id)
        } else {
            selectedLessonIDs.insert(lesson.id)
        }
    }

    private func rateLine(_ student: StudentModels.StudentResponse) -> String {
        let rate = InvoiceDerivations.formatCompactCurrency(student.expectedAmount, currency: userCurrency)
        return "\(rate)\(StudentDerivations.rateUnit(student.rateType)) · \(StudentDerivations.rateTypeLabel(student.rateType))"
    }

    private var userCurrency: String {
        if case .signedIn(let user) = session.phase { return user.currency ?? "AUD" }
        return "AUD"
    }

    @MainActor
    private func prepare() async {
        if let preselectedStudent {
            if students.isEmpty {
                students = [preselectedStudent]
                studentID = preselectedStudent.id
            }
            await loadLessons()
        } else {
            // Shared cache — usually already warm from other screens.
            await studentStore.loadIfNeeded(session)
        }
    }

    @MainActor
    private func loadLessons() async {
        guard !studentID.isEmpty else { return }
        isLoadingLessons = true
        defer { isLoadingLessons = false }
        do {
            let studentID = self.studentID
            unpaidLessons = try await lessonStore.loadUnpaid(studentId: studentID, session)
            if !lessonsLoaded, let preselectedLessonID {
                selectedLessonIDs = [preselectedLessonID]
            }
            lessonsLoaded = true
        } catch {
            // Keep the empty list; groups render the "no unpaid" state.
        }
    }

    @MainActor
    private func submit(status: String, send: Bool) async {
        guard !isSubmitting, let student = selectedStudent else { return }
        let items = lineItemBodies(student)
        guard !items.isEmpty else { return }
        isSubmitting = true
        defer { isSubmitting = false }
        do {
            // Local-midnight instant for the picked due date, matching the
            // web client's date-only input → ISO conversion.
            var calendar = Calendar.current
            calendar.timeZone = .current
            let due = calendar.dateInterval(of: .day, for: dueDate)?.start ?? dueDate
            let override = billingEmailOverride.trimmingCharacters(in: .whitespaces)
            let created = try await invoiceStore.create(
                CreateInvoiceBody(
                    studentId: student.id,
                    lineItems: items,
                    billingEmail: override.isEmpty ? nil : override,
                    dueDate: ISO8601DateFormatter().string(from: due),
                    paymentMethod: paymentMethod,
                    status: status,
                    notes: notes.isEmpty ? nil : notes),
                session)
            lessonStore.applyInvoiceCreated(lessonIds: items.map(\.lessonId), invoiceId: created.id)
            if send {
                sendTarget = created
            } else {
                onCreated?()
                dismiss()
            }
        } catch is CancellationError {
        } catch AuthFailure.cancelled {
        } catch {
            failureMessage = AuthFailure.message(for: error)
            failed = true
        }
    }
}
