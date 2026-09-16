import SwiftUI

struct LessonDetailView: View {
    let session: SessionStore
    let lessonID: String

    @Environment(LessonStore.self) private var lessonStore
    @State private var api: any LessonServing = LessonAPI.live()
    @State private var studentsAPI: any StudentsServing = StudentsAPI.live()
    @State private var loadState = LoadState()
    @State private var lesson: LessonModels.LessonResponse?
    @State private var student: StudentModels.StudentResponse?

    // Notes editor
    @State private var notesDraft = ""
    @State private var notesInitialized = false
    @State private var isSavingNotes = false

    // Checklist
    @State private var todos: [LessonModels.LessonTodo] = []
    @State private var newTodoText = ""
    @State private var isSavingTodos = false

    // Sheets & pending work
    @State private var showNotify = false
    @State private var showReschedule = false
    @State private var showCancel = false
    @State private var showCreateInvoice = false
    @State private var generatingMeet = false
    @State private var actionFailed = false
    @State private var actionFailureMessage: String?

    var body: some View {
        List {
            if let lesson, let student {
                content(lesson, student)
            }
        }
        .navigationTitle(lesson?.subject ?? "Lesson")
        .navigationBarTitleDisplayMode(.inline)
        .loadStateOverlay(loadState, hasContent: lesson != nil, errorTitle: "Could not load lesson") {
            Task { await load() }
        }
        .task {
            if lesson == nil { await load() }
        }
        .refreshable { await load(fatal: false) }
        .onChange(of: showCreateInvoice) {
            // Reflect invoiceId set by the create-invoice sheet.
            if !showCreateInvoice { Task { await load(fatal: false) } }
        }
        .sheet(isPresented: $showNotify) {
            if let lesson {
                EmailComposeSheet(
                    title: "Notify \(student?.name ?? "student")",
                    sendLabel: "Send email",
                    fetchPreview: { message in
                        try await lessonStore.notifyStudentPreview(id: lesson.id, message: message, session)
                    },
                    send: { message in
                        let updated = try await lessonStore.notifyStudent(id: lesson.id, message: message, session)
                        self.lesson = updated
                    },
                    onSent: {}
                )
            }
        }
        .sheet(isPresented: $showReschedule) {
            if let lesson {
                RescheduleSheet(session: session, lesson: lesson) { updated in
                    self.lesson = updated
                    lessonStore.apply(updated)
                }
            }
        }
        .sheet(isPresented: $showCancel) {
            if let lesson {
                CancelLessonSheet(session: session, lesson: lesson) { updated in
                    self.lesson = updated
                    lessonStore.apply(updated)
                }
            }
        }
        .sheet(isPresented: $showCreateInvoice) {
            if let student {
                CreateInvoiceView(session: session, preselectedStudent: student,
                                  preselectedLessonID: lesson?.id)
            }
        }
        .alert("Could not save", isPresented: $actionFailed) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(actionFailureMessage ?? "Please try again.")
        }
    }

    // MARK: Content

    @ViewBuilder
    private func content(_ lesson: LessonModels.LessonResponse, _ student: StudentModels.StudentResponse) -> some View {
        headerSection(lesson, student)

        let now = Date()
        let canManage = !(lesson.isCancelled ?? false) && !LessonDerivations.isFinished(lesson, now: now)
        if canManage {
            Section {
                notifyButton(lesson, student)
                Button("Reschedule") { showReschedule = true }
                    .accessibilityIdentifier("lesson.reschedule")
            } header: {
                Text("Actions")
            }
        }

        invoiceSection(lesson)
        subjectSection(lesson, student)
        notesSection(lesson)
        checklistSection(lesson)
        outcomeSection(lesson)

        if !(lesson.isCancelled ?? false) {
            Section {
                Button("Cancel lesson", role: .destructive) { showCancel = true }
                    .accessibilityIdentifier("lesson.cancel")
            }
        }
    }

    private func headerSection(_ lesson: LessonModels.LessonResponse, _ student: StudentModels.StudentResponse) -> some View {
        Section {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("\(lesson.subject ?? "Lesson") — \(student.name)")
                        .font(.headline)
                    HStack(spacing: 6) {
                        let badge = LessonDerivations.lessonBadge(lesson)
                        BadgeView(label: badge.label, tone: badge.tone)
                        if lesson.seriesId != nil {
                            BadgeView(label: "Recurring", tone: .muted)
                        }
                    }
                }
                Spacer()
                if let meetLink = lesson.meetLink, let url = URL(string: meetLink) {
                    Link("Join", destination: url)
                        .buttonStyle(.borderedProminent)
                        .controlSize(.small)
                }
            }

            if let start = LessonDerivations.date(lesson.startDateTime) {
                LabeledContent("When") {
                    Text(LessonDerivations.formatLessonDateTime(start))
                }
                let end = start.addingTimeInterval(TimeInterval(lesson.durationMinutes) * 60)
                LabeledContent("Duration") {
                    Text("\(LessonDerivations.formatLessonTime(start)) – \(LessonDerivations.formatLessonTime(end)) (\(lesson.durationMinutes) min)")
                }
            }
            LabeledContent("Location") {
                if let meetLink = lesson.meetLink {
                    Link(meetLink, destination: URL(string: meetLink) ?? URL(string: "about:blank")!)
                        .lineLimit(1)
                } else if generatingMeet {
                    ProgressView()
                } else if let location = lesson.location, !location.isEmpty {
                    Text(location)
                } else {
                    Text("Not specified").foregroundStyle(.secondary)
                }
            }
            if lesson.meetLink == nil {
                Button("Generate Meet link") {
                    Task { await generateMeetLink(lesson) }
                }
                .disabled(generatingMeet)
            }
            LabeledContent("Student response") {
                Text(LessonDerivations.acceptanceLabel(lesson.acceptanceStatus))
                    .foregroundStyle(acceptanceColor(lesson.acceptanceStatus))
            }
            if let notifiedAt = lesson.lastStudentNotifiedAt,
               let date = LessonDerivations.date(notifiedAt) {
                LabeledContent("Last reminded") {
                    Text(LessonDerivations.formatLessonDateTime(date))
                }
            }
        }
        .accessibilityIdentifier("lesson.header")
    }

    private func invoiceSection(_ lesson: LessonModels.LessonResponse) -> some View {
        Section("Invoice") {
            if lesson.isPaid {
                Label("Lesson paid", systemImage: "checkmark.circle.fill")
                    .foregroundStyle(.green)
            } else if lesson.invoiceId != nil {
                Label("On an invoice", systemImage: "doc.text")
                    .foregroundStyle(.secondary)
            } else if InvoiceDerivations.isChargeableAttendance(lesson) {
                Button("Create invoice") { showCreateInvoice = true }
                    .accessibilityIdentifier("lesson.createInvoice")
            } else if LessonDerivations.isFinished(lesson) {
                Text("Record attendance to invoice this lesson.")
                    .foregroundStyle(.secondary)
                    .font(.footnote)
            } else {
                Text("Available after the lesson takes place.")
                    .foregroundStyle(.secondary)
                    .font(.footnote)
            }
        }
    }

    private func subjectSection(_ lesson: LessonModels.LessonResponse, _ student: StudentModels.StudentResponse) -> some View {
        Section("Details") {
            // Subjects the student studies, from the tutor's catalogue.
            let catalogue = sessionSubjects
            let studentSubjects = student.subjectIds.compactMap { id in catalogue.first { $0.id == id } }
            let options = studentSubjects.filter { $0.name != lesson.subject }
            Menu {
                Button("No subject") { Task { await updateSubject(nil, on: lesson) } }
                ForEach(options, id: \.id) { subject in
                    Button(subject.name) { Task { await updateSubject(subject.name, on: lesson) } }
                }
            } label: {
                LabeledContent("Subject") {
                    Text(lesson.subject ?? "No subject").foregroundStyle(.tint)
                }
            }
            .disabled(options.isEmpty && lesson.subject == nil)
        }
    }

    private func notesSection(_ lesson: LessonModels.LessonResponse) -> some View {
        Section("Notes") {
            TextEditor(text: $notesDraft)
                .frame(minHeight: 80)
                .accessibilityIdentifier("lesson.notes")
            if notesDraft != serverNotes {
                HStack {
                    Button("Save") { Task { await saveNotes(on: lesson) } }
                        .disabled(isSavingNotes)
                    if isSavingNotes {
                        ProgressView()
                    }
                }
            }
        }
    }

    private func checklistSection(_ lesson: LessonModels.LessonResponse) -> some View {
        Section {
            ForEach(todos) { todo in
                Button {
                    toggle(todo, on: lesson)
                } label: {
                    HStack {
                        Image(systemName: todo.done ? "checkmark.circle.fill" : "circle")
                            .foregroundStyle(todo.done ? .green : .secondary)
                        Text(todo.text)
                            .strikethrough(todo.done)
                            .foregroundStyle(todo.done ? .secondary : .primary)
                        Spacer()
                    }
                }
                .buttonStyle(.plain)
            }
            .onDelete { offsets in
                todos.remove(atOffsets: offsets)
                Task { await saveTodos(on: lesson) }
            }
            HStack {
                TextField("Add a task…", text: $newTodoText)
                    .onSubmit(addTodo)
                Button("Add", action: addTodo)
                    .disabled(newTodoText.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            if isSavingTodos {
                Text("Saving…").font(.caption).foregroundStyle(.secondary)
            }
        } header: {
            HStack {
                Text("Checklist")
                Spacer()
                Text("\(todos.filter(\.done).count)/\(todos.count)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func outcomeSection(_ lesson: LessonModels.LessonResponse) -> some View {
        Section("Outcome") {
            if lesson.isCancelled ?? false {
                Text("This occurrence has been cancelled.")
                    .foregroundStyle(.red)
            } else {
                Menu {
                    ForEach(LessonDerivations.attendanceOptions, id: \.self) { status in
                        Button(LessonDerivations.attendanceLabel(status)) {
                            Task { await record(status, on: lesson) }
                        }
                    }
                } label: {
                    LabeledContent("Attendance") {
                        Text(LessonDerivations.attendanceLabel(lesson.attendanceStatus))
                            .foregroundStyle(.tint)
                    }
                }
            }
        }
    }

    // MARK: Notify button

    @ViewBuilder
    private func notifyButton(_ lesson: LessonModels.LessonResponse, _ student: StudentModels.StudentResponse) -> some View {
        let studentEmail = student.email?.trimmingCharacters(in: .whitespaces) ?? ""
        let verified = isEmailVerified
        let cooldown = cooldownRemaining(lesson)
        let disabled = studentEmail.isEmpty || !verified || cooldown != nil
        Button {
            showNotify = true
        } label: {
            VStack(alignment: .leading, spacing: 2) {
                Text(lesson.lastStudentNotifiedAt == nil ? "Notify student" : "Notify again")
                if !studentEmail.isEmpty && !verified {
                    Text("Verify your email first")
                        .font(.caption).foregroundStyle(.secondary)
                } else if studentEmail.isEmpty {
                    Text("This student needs an email before you can send.")
                        .font(.caption).foregroundStyle(.secondary)
                } else if let cooldown {
                    Text("Already notified — resend in \(cooldown)")
                        .font(.caption).foregroundStyle(.secondary)
                }
            }
        }
        .disabled(disabled)
        .accessibilityIdentifier("lesson.notify")
    }

    // MARK: Actions

    @MainActor
    private func load(fatal: Bool = true) async {
        await loadState.run(fatal: fatal) {
            let loadedLesson = try await session.authenticated { token in
                try await api.lesson(id: lessonID, accessToken: token)
            }
            try Task.checkCancellation()
            let loadedStudent = try await session.authenticated { token in
                try await studentsAPI.student(id: loadedLesson.studentId, accessToken: token)
            }
            try Task.checkCancellation()
            lesson = loadedLesson
            student = loadedStudent
            if !notesInitialized {
                notesDraft = loadedLesson.notes ?? ""
                notesInitialized = true
            }
            todos = loadedLesson.todos ?? []
        }
    }

    private var sessionSubjects: [AuthModels.Subject] {
        if case .signedIn(let user) = session.phase { return user.subjects ?? [] }
        return []
    }

    private var isEmailVerified: Bool {
        if case .signedIn(let user) = session.phase { return user.emailVerified ?? true }
        return true
    }

    private func cooldownRemaining(_ lesson: LessonModels.LessonResponse, now: Date = .init()) -> String? {
        guard let notifiedAt = lesson.lastStudentNotifiedAt,
              let date = LessonDerivations.date(notifiedAt)
        else { return nil }
        let remaining = date.addingTimeInterval(LessonDerivations.studentNotifyCooldown).timeIntervalSince(now)
        guard remaining > 0 else { return nil }
        return LessonDerivations.formatMsRemaining(remaining)
    }

    @MainActor
    private func updateSubject(_ subject: String?, on lesson: LessonModels.LessonResponse) async {
        do {
            let updated = try await lessonStore.update(
                id: lesson.id,
                LessonModels.UpdateLessonRequest(subject: subject),
                session)
            self.lesson = updated
        } catch {
            fail(error)
        }
    }

    private var serverNotes: String {
        lesson?.notes ?? ""
    }

    @MainActor
    private func saveNotes(on lesson: LessonModels.LessonResponse) async {
        guard !isSavingNotes else { return }
        isSavingNotes = true
        defer { isSavingNotes = false }
        do {
            let notes = notesDraft.trimmingCharacters(in: .whitespacesAndNewlines)
            let updated = try await lessonStore.update(
                id: lesson.id,
                LessonModels.UpdateLessonRequest(notes: notes.isEmpty ? nil : notes),
                session)
            self.lesson = updated
        } catch {
            fail(error)
        }
    }

    private func addTodo() {
        let text = newTodoText.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty, let lesson else { return }
        newTodoText = ""
        todos.append(LessonModels.LessonTodo(id: "todo-\(UUID().uuidString)", text: text, done: false))
        Task { await saveTodos(on: lesson) }
    }

    private func toggle(_ todo: LessonModels.LessonTodo, on lesson: LessonModels.LessonResponse) {
        guard let index = todos.firstIndex(where: { $0.id == todo.id }) else { return }
        todos[index].done.toggle()
        Task { await saveTodos(on: lesson) }
    }

    @MainActor
    private func saveTodos(on lesson: LessonModels.LessonResponse) async {
        guard !isSavingTodos else { return }
        isSavingTodos = true
        defer { isSavingTodos = false }
        do {
            let updated = try await lessonStore.update(
                id: lesson.id,
                LessonModels.UpdateLessonRequest(todos: todos),
                session)
            self.lesson = updated
        } catch {
            fail(error)
        }
    }

    @MainActor
    private func record(_ status: String, on lesson: LessonModels.LessonResponse) async {
        do {
            let updated = try await lessonStore.recordAttendance(id: lesson.id, status: status, session)
            self.lesson = updated
        } catch {
            fail(error)
        }
    }

    @MainActor
    private func generateMeetLink(_ lesson: LessonModels.LessonResponse) async {
        guard !generatingMeet else { return }
        generatingMeet = true
        defer { generatingMeet = false }
        do {
            let updated = try await lessonStore.generateMeetLink(for: lesson, session)
            self.lesson = updated
        } catch {
            fail(error)
        }
    }

    private func fail(_ error: Error) {
        actionFailureMessage = AuthFailure.message(for: error)
        actionFailed = true
    }

    private func acceptanceColor(_ status: String) -> Color {
        switch status {
        case "accepted": return .green
        case "declined": return .red
        default: return .orange
        }
    }
}
