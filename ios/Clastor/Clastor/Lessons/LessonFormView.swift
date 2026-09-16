import SwiftUI

/// Create-lesson form — one-off or recurring series, mirroring the web's
/// CreateEventDialog. The series timezone is the student's timezone when set,
/// otherwise the device's (same rule as the web client).
struct LessonFormView: View {
    let session: SessionStore
    let onCreated: () -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(LessonStore.self) private var lessonStore
    @Environment(StudentStore.self) private var studentStore

    @State private var students: [StudentModels.StudentResponse] = []
    @State private var studentsLoaded = false
    @State private var studentID = ""
    @State private var subject = ""
    @State private var repeatMode = "none"
    @State private var start = Date()
    @State private var startDate = Calendar.current.startOfDay(for: Date().addingTimeInterval(86_400))
    @State private var durationMinutes = 60
    @State private var slots: [SlotDraft] = []
    @State private var endsMode = "until"
    @State private var endDate = Calendar.current.startOfDay(for: Date().addingTimeInterval(180 * 86_400))
    @State private var occurrenceCount = 12
    @State private var locationMode = "meet"
    @State private var customLocation = ""
    @State private var notes = ""

    @State private var isSubmitting = false
    @State private var failed = false
    @State private var failureMessage: String?

    struct SlotDraft: Identifiable, Equatable {
        let id = UUID()
        var day: String
        var time: Date
    }

    private static let days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    private static let dayLabels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

    private var selectedStudent: StudentModels.StudentResponse? {
        students.first { $0.id == studentID }
    }

    var body: some View {
        NavigationStack {
            Form {
                studentSection
                if repeatMode == "none" {
                    Section("One-off lesson") {
                        DatePicker("Starts", selection: $start)
                        DurationPicker(minutes: $durationMinutes)
                    }
                } else {
                    recurringSection
                }
                locationSection
                Section("Notes") {
                    TextField("What to cover, prep notes, etc.", text: $notes, axis: .vertical)
                }
            }
            .navigationTitle("New lesson")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") { Task { await submit() } }
                        .disabled(isSubmitting || studentID.isEmpty || slots.isEmpty && repeatMode != "none")
                }
            }
            .task { await loadStudents() }
            .alert("Could not create", isPresented: $failed) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(failureMessage ?? "Please try again.")
            }
        }
    }

    // MARK: Sections

    private var studentSection: some View {
        Section {
            if studentsLoaded && students.isEmpty {
                Text("Add a student first.")
                    .foregroundStyle(.secondary)
            } else {
                Picker("Student", selection: $studentID) {
                    Text("Select…").tag("")
                    ForEach(students, id: \.id) { student in
                        Text(student.name).tag(student.id)
                    }
                }
                if let student = selectedStudent {
                    Picker("Subject", selection: $subject) {
                        Text("No subject").tag("")
                        ForEach(subjectOptions(for: student), id: \.self) { name in
                            Text(name).tag(name)
                        }
                    }
                }
                Picker("Repeat", selection: $repeatMode) {
                    Text("One time").tag("none")
                    Text("Weekly").tag("weekly")
                    Text("Every 2 weeks").tag("biweekly")
                    Text("Every 4 weeks").tag("monthly")
                }
            }
        } footer: {
            if let student = selectedStudent, !student.subjectIds.isEmpty {
                Text(rateLine(for: student))
            }
        }
    }

    private var recurringSection: some View {
        Section {
            DatePicker("Starts on", selection: $startDate, displayedComponents: .date)
            ForEach($slots) { $slot in
                HStack {
                    Picker("", selection: $slot.day) {
                        ForEach(Self.days.indices, id: \.self) { index in
                            Text(Self.dayLabels[index]).tag(Self.days[index])
                        }
                    }
                    .labelsHidden()
                    DatePicker("", selection: $slot.time, displayedComponents: .hourAndMinute)
                        .labelsHidden()
                }
            }
            .onDelete { slots.remove(atOffsets: $0) }
            Button("Add lesson time") {
                if slots.isEmpty {
                    // Seed from the start date's weekday + a 16:00 default.
                    let weekdayIndex = (Calendar.current.component(.weekday, from: startDate) + 5) % 7
                    var components = Calendar.current.dateComponents([.year, .month, .day], from: Date())
                    components.hour = 16
                    let time = Calendar.current.date(from: components) ?? Date()
                    slots.append(SlotDraft(day: Self.days[weekdayIndex], time: time))
                } else {
                    slots.append(slots[slots.count - 1])
                }
            }
            .disabled(slots.count >= 7)
            DurationPicker(minutes: $durationMinutes)
            Picker("Ends", selection: $endsMode) {
                Text("On date").tag("until")
                Text("After N lessons").tag("count")
            }
            if endsMode == "until" {
                DatePicker("End date", selection: $endDate, displayedComponents: .date)
            } else {
                Stepper("Lessons: \(occurrenceCount)", value: $occurrenceCount, in: 1...200)
            }
        } header: {
            Text("Recurring series")
        } footer: {
            if slots.count < 1 {
                Text("Add at least one weekly lesson time.")
            }
        }
    }

    private var locationSection: some View {
        Section("Location") {
            Picker("Location", selection: $locationMode) {
                Text("Google Meet").tag("meet")
                Text("In person").tag("in_person")
                Text("Other").tag("other")
            }
            if locationMode == "other" {
                TextField("Where?", text: $customLocation)
            }
        }
    }

    // MARK: Helpers

    @MainActor
    private func loadStudents() async {
        guard !studentsLoaded else { return }
        await studentStore.loadIfNeeded(session)
        students = studentStore.students
        if studentID.isEmpty, students.count == 1 {
            studentID = students[0].id
        }
        studentsLoaded = true
    }

    private func subjectOptions(for student: StudentModels.StudentResponse) -> [String] {
        let catalogue = sessionSubjects
        return student.subjectIds.compactMap { id in catalogue.first { $0.id == id }?.name }
    }

    private var sessionSubjects: [AuthModels.Subject] {
        if case .signedIn(let user) = session.phase { return user.subjects ?? [] }
        return []
    }

    private func rateLine(for student: StudentModels.StudentResponse) -> String {
        let currency = userCurrency
        let rate = InvoiceDerivations.formatCompactCurrency(student.expectedAmount, currency: currency)
        return "Rate: \(rate)\(StudentDerivations.rateUnit(student.rateType)) · Billing: \(student.billingEmail ?? "no email")"
    }

    private var userCurrency: String {
        if case .signedIn(let user) = session.phase { return user.currency ?? "AUD" }
        return "AUD"
    }

    private var resolvedLocation: String? {
        switch locationMode {
        case "meet": return "Google Meet"
        case "in_person": return "In Person"
        default:
            let trimmed = customLocation.trimmingCharacters(in: .whitespaces)
            return trimmed.isEmpty ? nil : trimmed
        }
    }

    // MARK: Submit

    @MainActor
    private func submit() async {
        guard !isSubmitting else { return }
        guard let student = selectedStudent else { return }
        guard repeatMode == "none" || !slots.isEmpty else { return }
        isSubmitting = true
        defer { isSubmitting = false }
        do {
            let timezone = student.timezone ?? TimeZone.current.identifier
            if repeatMode == "none" {
                let created = try await lessonStore.create(
                    LessonModels.CreateLessonRequest(
                        studentId: student.id,
                        subject: subject.isEmpty ? nil : subject,
                        startDateTime: ISO8601DateFormatter().string(from: start),
                        durationMinutes: durationMinutes,
                        location: resolvedLocation,
                        notes: notes.isEmpty ? nil : notes,
                        remindersEnabled: true),
                    session)
                if locationMode == "meet" {
                    await attachMeetLink(to: created)
                }
            } else {
                let dayFormatter = DateFormatter()
                dayFormatter.locale = Locale(identifier: "en_AU_POSIX")
                dayFormatter.dateFormat = "yyyy-MM-dd"
                dayFormatter.timeZone = TimeZone.current
                let timeFormatter = DateFormatter()
                timeFormatter.locale = Locale(identifier: "en_AU_POSIX")
                timeFormatter.dateFormat = "HH:mm"
                timeFormatter.timeZone = TimeZone.current
                _ = try await lessonStore.createRecurring(
                    LessonModels.CreateRecurringLessonRequest(
                        studentId: student.id,
                        subject: subject.isEmpty ? nil : subject,
                        durationMinutes: durationMinutes,
                        location: resolvedLocation,
                        notes: notes.isEmpty ? nil : notes,
                        intervalWeeks: repeatMode == "biweekly" ? 2 : (repeatMode == "monthly" ? 4 : 1),
                        slots: slots.map { LessonModels.LessonSlot(dayOfWeek: $0.day, timeOfDay: timeFormatter.string(from: $0.time)) },
                        timezone: timezone,
                        startDate: dayFormatter.string(from: startDate),
                        until: endsMode == "until" ? dayFormatter.string(from: endDate) : nil,
                        count: endsMode == "count" ? occurrenceCount : nil,
                        remindersEnabled: true),
                    session)
            }
            onCreated()
            dismiss()
        } catch is CancellationError {
        } catch AuthFailure.cancelled {
        } catch {
            failureMessage = AuthFailure.message(for: error)
            failed = true
        }
    }

    /// Best-effort Meet provisioning after a one-off create (the web shows a
    /// warning toast on failure; here the lesson still exists without a link).
    @MainActor
    private func attachMeetLink(to lesson: LessonModels.LessonResponse) async {
        // Best effort — a failure just leaves the lesson without a link.
        _ = try? await lessonStore.generateMeetLink(for: lesson, session)
    }
}
