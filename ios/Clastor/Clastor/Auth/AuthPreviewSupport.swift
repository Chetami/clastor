#if DEBUG
import Foundation

// Offline dependencies for previews and UI tests. No real Firebase, API or
// Keychain is reachable through this session. Omitted from Release builds.
// All feature APIs share PreviewStore so mutations made in one tab surface
// everywhere (e.g. marking attendance updates the invoice screen's lessons).
@MainActor
enum AuthPreviewSupport {
    static var isUITesting: Bool { ProcessInfo.processInfo.arguments.contains("--auth-ui-test") }
    static var isPreview: Bool { ProcessInfo.processInfo.environment["XCODE_RUNNING_FOR_PREVIEWS"] == "1" }

    private static var mode: String { ProcessInfo.processInfo.environment["AUTH_TEST_SCENARIO"] ?? "success" }

    static func studentsAPI() -> any StudentsServing {
        PreviewStudentsAPI(mode: mode)
    }

    static func homeAPI() -> any HomeServing {
        PreviewHomeAPI(mode: mode)
    }

    static func lessonAPI() -> any LessonServing {
        PreviewLessonAPI(mode: mode)
    }

    static func invoiceAPI() -> any InvoiceServing {
        PreviewInvoiceAPI(mode: mode)
    }

    static func session() -> SessionStore {
        let mode = mode
        return SessionStore(appName: "Clastor", identity: PreviewIdentity(reject: mode == "invalid-password"),
                            api: PreviewAPI(unavailable: mode == "backend-unavailable"), storage: PreviewStorage())
    }
}

// MARK: - Fixtures

@MainActor
final class PreviewStore {
    static let shared = PreviewStore()
    private let now = Date()
    private let iso = ISO8601DateFormatter()

    private(set) var students: [StudentModels.StudentResponse]
    private(set) var lessons: [LessonModels.LessonResponse]
    private(set) var invoices: [PaymentModels.InvoiceResponse]
    private(set) var events: [PaymentModels.InvoiceEventResponse]

    private init() {
        // Initialize everything first — the fixture builders below are
        // instance methods and need a fully initialized self.
        students = []
        lessons = []
        invoices = []
        events = []
        let created = "2026-01-01T00:00:00Z"
        students = [
            student(id: "preview-0", name: "Alex Example", email: "alex@example.test",
                    subjectIds: ["subj-math"], expectedAmount: 60, rateType: "hourly", frequency: 2),
            student(id: "preview-1", name: "Sam Example", email: "sam@example.test",
                    parentEmail: "parent@example.test", subjectIds: ["subj-phys"],
                    expectedAmount: 40, rateType: "per_lesson", frequency: 1),
        ]
        lessons = [
            lesson(id: "preview-in-progress", studentIndex: 0, subject: "Mathematics",
                   minutesFromNow: -20, durationMinutes: 60, attendanceStatus: "unrecorded",
                   meetLink: "https://meet.google.com/preview"),
            lesson(id: "preview-next", studentIndex: 1, subject: "Physics",
                   minutesFromNow: 3 * 60, durationMinutes: 60, attendanceStatus: "unrecorded",
                   acceptanceStatus: "accepted"),
            lesson(id: "preview-todo", studentIndex: 0, subject: "Mathematics",
                   minutesFromNow: -24 * 60, durationMinutes: 60, attendanceStatus: "unrecorded",
                   todos: [todo("Review chapter 5", done: false), todo("Mark mock exam", done: true)]),
            lesson(id: "preview-done", studentIndex: 1, subject: "Chemistry",
                   minutesFromNow: -48 * 60, durationMinutes: 90, attendanceStatus: "present",
                   invoiceId: "invoice-paid", isPaid: true),
            lesson(id: "preview-chargeable", studentIndex: 0, subject: "Mathematics",
                   minutesFromNow: -72 * 60, durationMinutes: 60, attendanceStatus: "present"),
            lesson(id: "preview-later", studentIndex: 1, subject: "Physics",
                   minutesFromNow: 4 * 24 * 60, durationMinutes: 60, attendanceStatus: "unrecorded"),
        ]
        invoices = [
            invoice(id: "invoice-paid", number: "INV-0001", studentIndex: 1, status: "paid",
                    lessonIndex: 3, dueDaysFromNow: -5, sentDaysFromNow: -10, paidDaysFromNow: -5),
            invoice(id: "invoice-open", number: "INV-0002", studentIndex: 0, status: "open",
                    lessonIndex: nil, dueDaysFromNow: 10, sentDaysFromNow: -2),
            invoice(id: "invoice-overdue", number: "INV-0003", studentIndex: 0, status: "open",
                    lessonIndex: nil, dueDaysFromNow: -6, sentDaysFromNow: -20),
            invoice(id: "invoice-draft", number: "INV-0004", studentIndex: 1, status: "draft",
                    lessonIndex: nil, dueDaysFromNow: 14),
        ]
        events = [
            event(id: "event-1", invoiceId: "invoice-paid", type: "created",
                  summary: "Invoice created", daysFromNow: -10),
            event(id: "event-2", invoiceId: "invoice-paid", type: "sent",
                  summary: "Invoice sent to parent@example.test", daysFromNow: -10),
            event(id: "event-3", invoiceId: "invoice-paid", type: "payment_received",
                  summary: "Marked as paid via Bank Transfer", daysFromNow: -5),
        ]
    }

    // MARK: Access

    func student(id: String) -> StudentModels.StudentResponse? {
        students.first { $0.id == id }
    }

    func lesson(id: String) -> LessonModels.LessonResponse? {
        lessons.first { $0.id == id }
    }

    func invoice(id: String) -> PaymentModels.InvoiceResponse? {
        invoices.first { $0.id == id }
    }

    // MARK: Mutations

    func upsert(_ lesson: LessonModels.LessonResponse) {
        if let index = lessons.firstIndex(where: { $0.id == lesson.id }) {
            lessons[index] = lesson
        } else {
            lessons.append(lesson)
        }
    }

    func apply(_ id: String, transform: (inout LessonModels.LessonResponse) -> Void) {
        if let index = lessons.firstIndex(where: { $0.id == id }) {
            transform(&lessons[index])
        }
    }

    func upsert(_ student: StudentModels.StudentResponse) {
        if let index = students.firstIndex(where: { $0.id == student.id }) {
            students[index] = student
        } else {
            students.append(student)
        }
    }

    func apply(_ id: String, transform: (inout StudentModels.StudentResponse) -> Void) {
        if let index = students.firstIndex(where: { $0.id == id }) {
            transform(&students[index])
        }
    }

    func upsert(_ invoice: PaymentModels.InvoiceResponse) {
        if let index = invoices.firstIndex(where: { $0.id == invoice.id }) {
            invoices[index] = invoice
        } else {
            invoices.append(invoice)
        }
    }

    func appendEvent(invoiceId: String, type: String, summary: String) {
        events.append(event(id: "event-\(events.count + 1)", invoiceId: invoiceId, type: type,
                            summary: summary, daysFromNow: 0))
    }

    // MARK: Builders

    private func isoString(_ date: Date) -> String { iso.string(from: date) }

    private func student(id: String, name: String, email: String?, parentEmail: String? = nil,
                         subjectIds: [String], expectedAmount: Double, rateType: String, frequency: Int) -> StudentModels.StudentResponse {
        StudentModels.StudentResponse(
            id: id, name: name, email: email, phone: nil, parentEmail: parentEmail,
            billingEmail: parentEmail, billingEmailSource: parentEmail != nil ? "parent" : "student",
            subjectIds: subjectIds, expectedAmount: expectedAmount, rateType: rateType,
            frequencyPerWeek: frequency, status: "active", timezone: nil, notes: nil,
            amountOwed: 0, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z"
        )
    }

    private func todo(_ text: String, done: Bool) -> LessonModels.LessonTodo {
        LessonModels.LessonTodo(id: "todo-\(UUID().uuidString.prefix(8).lowercased())", text: text, done: done)
    }

    private func lesson(id: String, studentIndex: Int, subject: String, minutesFromNow: Double,
                        durationMinutes: Int, attendanceStatus: String,
                        acceptanceStatus: String = "pending", meetLink: String? = nil,
                        todos: [LessonModels.LessonTodo]? = nil,
                        invoiceId: String? = nil, isPaid: Bool = false) -> LessonModels.LessonResponse {
        LessonModels.LessonResponse(
            id: id, studentId: "preview-\(studentIndex)", subject: subject,
            startDateTime: isoString(now.addingTimeInterval(minutesFromNow * 60)),
            durationMinutes: durationMinutes, location: "Google Meet", meetLink: meetLink,
            notes: nil, todos: todos, acceptanceStatus: acceptanceStatus,
            attendanceStatus: attendanceStatus, seriesId: nil, isCancelled: false,
            remindersEnabled: true, isPaid: isPaid, invoiceId: invoiceId,
            createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z"
        )
    }

    private func invoice(id: String, number: String, studentIndex: Int, status: String,
                         lessonIndex: Int?, dueDaysFromNow: Int, sentDaysFromNow: Int? = nil,
                         paidDaysFromNow: Int? = nil) -> PaymentModels.InvoiceResponse {
        let student = students[studentIndex]
        var lineItems: [PaymentModels.InvoiceLineItem] = []
        if let lessonIndex {
            let lesson = lessons[lessonIndex]
            let quantity = student.rateType == "hourly" ? Double(lesson.durationMinutes) / 60 : 1
            let unit = student.expectedAmount
            let amount = (unit * quantity * 100).rounded() / 100
            lineItems.append(PaymentModels.InvoiceLineItem(
                lessonId: lesson.id, description: "\(lesson.subject ?? "Lesson") — \(lesson.durationMinutes) min",
                durationMinutes: lesson.durationMinutes, rateType: student.rateType,
                unitAmount: unit, quantity: quantity, amount: amount))
        }
        let total = lineItems.reduce(0.0) { $0 + $1.amount }
        return PaymentModels.InvoiceResponse(
            id: id, invoiceNumber: number, tutorId: "preview-user", studentId: student.id,
            customerName: student.name, billingEmail: student.billingEmail, status: status,
            currency: "AUD", lineItems: lineItems, subtotal: total, total: total,
            paymentMethod: "bank_transfer",
            issueDate: isoString(now.addingTimeInterval(-30 * 86_400)),
            dueDate: isoString(now.addingTimeInterval(TimeInterval(dueDaysFromNow) * 86_400)),
            paidAt: paidDaysFromNow.map { isoString(now.addingTimeInterval(TimeInterval($0) * 86_400)) },
            sentAt: sentDaysFromNow.map { isoString(now.addingTimeInterval(TimeInterval($0) * 86_400)) },
            notes: nil, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z"
        )
    }

    private func event(id: String, invoiceId: String, type: String, summary: String, daysFromNow: Int) -> PaymentModels.InvoiceEventResponse {
        PaymentModels.InvoiceEventResponse(
            id: id, invoiceId: invoiceId, type: type, summary: summary, actorName: "Test Tutor",
            timestamp: iso.string(from: now.addingTimeInterval(TimeInterval(daysFromNow) * 86_400))
        )
    }

    // MARK: Email previews

    func emailPreview(subject: String, to: [String], message: String?) -> LessonModels.EmailPreviewResponse {
        let defaultMessage = "Hi! A quick reminder about your upcoming lesson."
        let body = (message?.isEmpty == false ? message! : defaultMessage)
        return LessonModels.EmailPreviewResponse(
            to: to, subject: subject,
            text: body + "\n\n— Test Tutor",
            html: "<html><body style=\"font-family: -apple-system; padding: 16px;\"><p>\(body)</p><p style=\"color: #666;\">— Test Tutor</p></body></html>",
            defaultSubject: subject, defaultMessage: defaultMessage
        )
    }
}

// MARK: - Auth

@MainActor
private final class PreviewIdentity: FirebaseSigningIn {
    let reject: Bool
    init(reject: Bool) { self.reject = reject }
    func signIn(email: String, password: String) async throws -> String {
        if reject { throw AuthFailure.invalidCredentials }
        return "offline-preview-identity"
    }
    func signOut() throws {}
}

@MainActor
private final class PreviewAPI: AuthServing {
    let unavailable: Bool
    let user = AuthModels.UserInfo(
        uid: "preview-user", name: "Test Tutor", email: "tutor@example.test", role: "tutor",
        emailVerified: true, currency: "AUD", timezone: nil, reminderLeadTime: "24h",
        subjects: [
            AuthModels.Subject(id: "subj-math", name: "Mathematics", color: nil),
            AuthModels.Subject(id: "subj-phys", name: "Physics", color: nil),
            AuthModels.Subject(id: "subj-chem", name: "Chemistry", color: nil),
        ],
        onboardingComplete: true, tourSeen: true
    )
    init(unavailable: Bool) { self.unavailable = unavailable }
    func login(firebaseIDToken: String) async throws -> AuthModels.LoginResponse {
        if unavailable { throw AuthFailure.http(503) }
        return .init(jwtToken: "offline-preview-access", refreshToken: "offline-preview-refresh", user: user)
    }
    func verify(accessToken: String) async throws -> AuthModels.UserInfo { user }
    func refresh(refreshToken: String) async throws -> AuthModels.RefreshTokenResponse {
        .init(jwtToken: "offline-preview-access", refreshToken: "offline-preview-refresh", user: user)
    }
    func logout(refreshToken: String) async throws {}
}

@MainActor
private final class PreviewStorage: TokenStoring {
    var value: SessionCredentials?
    func read() throws -> SessionCredentials? { value }
    func save(_ credentials: SessionCredentials) throws { value = credentials }
    func clear() throws { value = nil }
}

// MARK: - Students

@MainActor
private final class PreviewStudentsAPI: StudentsServing {
    let mode: String
    init(mode: String) { self.mode = mode }

    func list(accessToken: String) async throws -> [StudentModels.StudentResponse] {
        if mode == "students-unavailable" { throw AuthFailure.network }
        if mode == "students-empty" { return [] }
        return PreviewStore.shared.students
    }

    func student(id: String, accessToken: String) async throws -> StudentModels.StudentResponse {
        guard let student = PreviewStore.shared.student(id: id) else { throw AuthFailure.invalidResponse }
        return student
    }

    func create(_ request: StudentModels.CreateStudentRequest, accessToken: String) async throws -> StudentModels.StudentResponse {
        let response = StudentModels.StudentResponse(
            id: "preview-\(UUID().uuidString.prefix(8).lowercased())",
            name: request.name, email: request.email, phone: request.phone,
            parentEmail: request.parentEmail, billingEmail: request.billingEmail,
            billingEmailSource: request.billingEmail != nil ? "explicit"
                : (request.parentEmail != nil ? "parent" : "student"),
            subjectIds: request.subjectIds, expectedAmount: request.expectedAmount,
            rateType: request.rateType, frequencyPerWeek: request.frequencyPerWeek,
            status: request.status ?? "active", timezone: request.timezone, notes: request.notes,
            amountOwed: 0, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z"
        )
        PreviewStore.shared.upsert(response)
        return response
    }

    func update(id: String, _ request: StudentModels.UpdateStudentRequest, accessToken: String) async throws -> StudentModels.StudentResponse {
        guard var student = PreviewStore.shared.student(id: id) else { throw AuthFailure.invalidResponse }
        if let name = request.name { student.name = name }
        if request.email != nil { student.email = request.email }
        if request.phone != nil { student.phone = request.phone }
        if request.parentEmail != nil { student.parentEmail = request.parentEmail }
        if request.billingEmail != nil { student.billingEmail = request.billingEmail }
        if let subjectIds = request.subjectIds { student.subjectIds = subjectIds }
        if let expectedAmount = request.expectedAmount { student.expectedAmount = expectedAmount }
        if let rateType = request.rateType { student.rateType = rateType }
        if let frequencyPerWeek = request.frequencyPerWeek { student.frequencyPerWeek = frequencyPerWeek }
        if let status = request.status { student.status = status }
        if request.timezone != nil { student.timezone = request.timezone }
        if request.notes != nil { student.notes = request.notes }
        PreviewStore.shared.upsert(student)
        return student
    }
}

// MARK: - Home

@MainActor
private final class PreviewHomeAPI: HomeServing {
    let mode: String
    init(mode: String) { self.mode = mode }

    func summary(period: String, accessToken: String) async throws -> HomeModels.DashboardSummaryResponse {
        if mode == "home-unavailable" { throw AuthFailure.network }
        return HomeModels.DashboardSummaryResponse(
            period: period,
            rangeStart: "2026-01-05T00:00:00Z", rangeEnd: "2026-01-12T00:00:00Z",
            hoursWorked: 6, income: 360, studentCount: 2,
            hoursSeries: [], incomeSeries: [], previousHoursSeries: [], previousIncomeSeries: [],
            previousHoursWorked: 4, previousIncome: 240, lessonsTaught: 4, previousLessonsTaught: 3,
            attendanceRate: 1, unbilledLessons: 2, outstandingAmount: 120, overdueAmount: 0,
            today: .init(income: 0, hours: 1, lessonCount: 1),
            yesterday: .init(income: 120, hours: 1, lessonCount: 1)
        )
    }
}

// MARK: - Lessons

@MainActor
private final class PreviewLessonAPI: LessonServing {
    let mode: String
    init(mode: String) { self.mode = mode }

    func list(filters: LessonListFilters, accessToken: String) async throws -> [LessonModels.LessonResponse] {
        if mode == "lessons-unavailable" { throw AuthFailure.network }
        return PreviewStore.shared.lessons.filter { lesson in
            if let studentId = filters.studentId, lesson.studentId != studentId { return false }
            if filters.unpaid, lesson.isPaid || lesson.invoiceId != nil { return false }
            if let acceptanceStatus = filters.acceptanceStatus, lesson.acceptanceStatus != acceptanceStatus { return false }
            if let attendanceStatus = filters.attendanceStatus, lesson.attendanceStatus != attendanceStatus { return false }
            if let from = filters.from,
               let start = HomeDerivations.date(lesson.startDateTime), start < from { return false }
            if let to = filters.to,
               let start = HomeDerivations.date(lesson.startDateTime), start >= to { return false }
            return true
        }
    }

    func lesson(id: String, accessToken: String) async throws -> LessonModels.LessonResponse {
        guard let lesson = PreviewStore.shared.lesson(id: id) else { throw AuthFailure.invalidResponse }
        return lesson
    }

    func create(_ request: LessonModels.CreateLessonRequest, accessToken: String) async throws -> LessonModels.LessonResponse {
        let response = LessonModels.LessonResponse(
            id: "preview-\(UUID().uuidString.prefix(8).lowercased())",
            studentId: request.studentId, subject: request.subject,
            startDateTime: request.startDateTime, durationMinutes: request.durationMinutes,
            location: request.location, notes: request.notes, todos: [],
            acceptanceStatus: "pending", attendanceStatus: "unrecorded",
            remindersEnabled: request.remindersEnabled ?? true, isPaid: false,
            createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z"
        )
        PreviewStore.shared.upsert(response)
        return response
    }

    func createRecurring(_ request: LessonModels.CreateRecurringLessonRequest, accessToken: String) async throws -> LessonModels.CreateRecurringLessonResponse {
        let count = min(request.count ?? 8, 8)
        for occurrence in 0..<count {
            let dayOffset = occurrence * request.intervalWeeks * 7
            let date = Date().addingTimeInterval(TimeInterval(dayOffset) * 86_400)
            PreviewStore.shared.upsert(LessonModels.LessonResponse(
                id: "preview-\(UUID().uuidString.prefix(8).lowercased())",
                studentId: request.studentId, subject: request.subject,
                startDateTime: ISO8601DateFormatter().string(from: date),
                durationMinutes: request.durationMinutes, location: request.location,
                notes: request.notes, todos: [], acceptanceStatus: "pending",
                attendanceStatus: "unrecorded", seriesId: "preview-series",
                remindersEnabled: request.remindersEnabled ?? true, isPaid: false,
                createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z"
            ))
        }
        return LessonModels.CreateRecurringLessonResponse(seriesId: "preview-series", count: count)
    }

    func update(id: String, _ request: LessonModels.UpdateLessonRequest, accessToken: String) async throws -> LessonModels.LessonResponse {
        guard let lesson = PreviewStore.shared.lesson(id: id) else { throw AuthFailure.invalidResponse }
        var next = lesson
        if request.subject != nil { next.subject = request.subject }
        if request.startDateTime != nil { next.startDateTime = request.startDateTime! }
        if let durationMinutes = request.durationMinutes { next.durationMinutes = durationMinutes }
        if request.location != nil { next.location = request.location }
        if request.meetLink != nil { next.meetLink = request.meetLink }
        if request.notes != nil { next.notes = request.notes }
        if let todos = request.todos { next.todos = todos }
        if let remindersEnabled = request.remindersEnabled { next.remindersEnabled = remindersEnabled }
        if let isPaid = request.isPaid { next.isPaid = isPaid }
        PreviewStore.shared.upsert(next)
        return next
    }

    func reschedule(id: String, _ request: LessonModels.RescheduleLessonRequest, accessToken: String) async throws -> LessonModels.LessonResponse {
        var response: LessonModels.LessonResponse?
        PreviewStore.shared.apply(id) { lesson in
            lesson.startDateTime = request.startDateTime
            if let durationMinutes = request.durationMinutes { lesson.durationMinutes = durationMinutes }
            if request.notifyStudent == true { lesson.acceptanceStatus = "pending" }
            response = lesson
        }
        guard let response else { throw AuthFailure.invalidResponse }
        return response
    }

    func reschedulePreview(id: String, _ request: LessonModels.RescheduleLessonRequest, accessToken: String) async throws -> LessonModels.EmailPreviewResponse {
        PreviewStore.shared.emailPreview(
            subject: "Updated lesson time",
            to: PreviewStore.shared.student(id: PreviewStore.shared.lesson(id: id)?.studentId ?? "")?.email.map { [$0] } ?? [],
            message: request.message)
    }

    func cancel(id: String, _ request: LessonModels.CancelLessonRequest, accessToken: String) async throws -> LessonModels.LessonResponse {
        var response: LessonModels.LessonResponse?
        PreviewStore.shared.apply(id) { lesson in
            lesson.isCancelled = true
            response = lesson
        }
        guard let response else { throw AuthFailure.invalidResponse }
        return response
    }

    func cancelPreview(id: String, _ request: LessonModels.CancelLessonRequest, accessToken: String) async throws -> LessonModels.EmailPreviewResponse {
        PreviewStore.shared.emailPreview(
            subject: "Lesson cancelled",
            to: PreviewStore.shared.student(id: PreviewStore.shared.lesson(id: id)?.studentId ?? "")?.email.map { [$0] } ?? [],
            message: request.message)
    }

    func notifyStudent(id: String, message: String?, accessToken: String) async throws -> LessonModels.LessonResponse {
        var response: LessonModels.LessonResponse?
        PreviewStore.shared.apply(id) { lesson in
            lesson.lastStudentNotifiedAt = ISO8601DateFormatter().string(from: Date())
            lesson.studentNotifiedCount = (lesson.studentNotifiedCount ?? 0) + 1
            response = lesson
        }
        guard let response else { throw AuthFailure.invalidResponse }
        return response
    }

    func notifyStudentPreview(id: String, message: String?, accessToken: String) async throws -> LessonModels.EmailPreviewResponse {
        PreviewStore.shared.emailPreview(
            subject: "Lesson reminder",
            to: PreviewStore.shared.student(id: PreviewStore.shared.lesson(id: id)?.studentId ?? "")?.email.map { [$0] } ?? [],
            message: message)
    }

    func recordAttendance(id: String, status: String, accessToken: String) async throws -> LessonModels.LessonResponse {
        var response: LessonModels.LessonResponse?
        PreviewStore.shared.apply(id) { lesson in
            lesson.attendanceStatus = status
            response = lesson
        }
        guard let response else { throw AuthFailure.invalidResponse }
        return response
    }

    func generateMeetLink(_ request: LessonModels.GenerateMeetLinkRequest, accessToken: String) async throws -> LessonModels.GenerateMeetLinkResponse {
        LessonModels.GenerateMeetLinkResponse(
            meetingLink: "https://meet.google.com/preview-\(UUID().uuidString.prefix(6).lowercased())",
            calendarEventId: "preview-event-\(UUID().uuidString.prefix(6).lowercased())")
    }
}

// MARK: - Invoices

@MainActor
private final class PreviewInvoiceAPI: InvoiceServing {
    let mode: String
    init(mode: String) { self.mode = mode }

    func list(status: String?, search: String?, accessToken: String) async throws -> [PaymentModels.InvoiceResponse] {
        if mode == "invoices-unavailable" { throw AuthFailure.network }
        return PreviewStore.shared.invoices.filter { invoice in
            if let status, status != "all", status != "overdue", invoice.status != status { return false }
            if let status, status == "overdue", !(invoice.status == "open" && InvoiceDerivations.isOverdue(invoice)) { return false }
            return true
        }
    }

    func invoice(id: String, accessToken: String) async throws -> PaymentModels.InvoiceResponse {
        guard let invoice = PreviewStore.shared.invoice(id: id) else { throw AuthFailure.invalidResponse }
        return invoice
    }

    func events(id: String, accessToken: String) async throws -> [PaymentModels.InvoiceEventResponse] {
        PreviewStore.shared.events.filter { $0.invoiceId == id }
    }

    func create(_ body: CreateInvoiceBody, accessToken: String) async throws -> PaymentModels.InvoiceResponse {
        let store = PreviewStore.shared
        let iso = ISO8601DateFormatter()
        let items = body.lineItems.map { item in
            PaymentModels.InvoiceLineItem(
                lessonId: item.lessonId, description: item.description,
                durationMinutes: item.durationMinutes, rateType: item.rateType,
                unitAmount: item.unitAmount, quantity: item.quantity,
                amount: InvoiceDerivations.roundLineAmount(unitAmount: item.unitAmount, quantity: item.quantity))
        }
        let total = (items.reduce(0.0) { $0 + $1.amount } * 100).rounded() / 100
        let id = "preview-invoice-\(UUID().uuidString.prefix(8).lowercased())"
        let student = store.student(id: body.studentId)
        let response = PaymentModels.InvoiceResponse(
            id: id, invoiceNumber: "INV-000\(store.invoices.count + 1)",
            tutorId: "preview-user", studentId: body.studentId,
            customerName: student?.name ?? "Student", billingEmail: body.billingEmail ?? student?.billingEmail,
            status: body.status ?? "draft", currency: "AUD", lineItems: items,
            subtotal: total, total: total, paymentMethod: body.paymentMethod,
            issueDate: iso.string(from: Date()), dueDate: body.dueDate,
            paidAt: nil, sentAt: nil, notes: body.notes,
            createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z"
        )
        store.upsert(response)
        store.appendEvent(invoiceId: id, type: "created", summary: "Invoice created")
        for item in body.lineItems {
            store.apply(item.lessonId) { lesson in
                lesson.invoiceId = id
            }
        }
        return response
    }

    func send(id: String, message: String?, accessToken: String) async throws -> PaymentModels.InvoiceResponse {
        guard var invoice = PreviewStore.shared.invoice(id: id) else { throw AuthFailure.invalidResponse }
        let iso = ISO8601DateFormatter()
        let wasSent = invoice.sentAt != nil
        invoice.status = "open"
        invoice.sentAt = iso.string(from: Date())
        PreviewStore.shared.upsert(invoice)
        PreviewStore.shared.appendEvent(invoiceId: id, type: wasSent ? "resent" : "sent",
                                        summary: wasSent ? "Invoice resent" : "Invoice sent")
        return invoice
    }

    func sendPreview(id: String, message: String?, accessToken: String) async throws -> LessonModels.EmailPreviewResponse {
        guard let invoice = PreviewStore.shared.invoice(id: id) else { throw AuthFailure.invalidResponse }
        return PreviewStore.shared.emailPreview(
            subject: "Invoice \(invoice.invoiceNumber)",
            to: invoice.billingEmail.map { [$0] } ?? [],
            message: message)
    }

    func markPaid(id: String, accessToken: String) async throws -> PaymentModels.InvoiceResponse {
        guard var invoice = PreviewStore.shared.invoice(id: id) else { throw AuthFailure.invalidResponse }
        let iso = ISO8601DateFormatter()
        invoice.status = "paid"
        invoice.paidAt = iso.string(from: Date())
        PreviewStore.shared.upsert(invoice)
        PreviewStore.shared.appendEvent(invoiceId: id, type: "payment_received", summary: "Marked as paid")
        for item in invoice.lineItems {
            PreviewStore.shared.apply(item.lessonId) { lesson in
                lesson.isPaid = true
            }
        }
        return invoice
    }

    func void(id: String, accessToken: String) async throws -> PaymentModels.InvoiceResponse {
        guard var invoice = PreviewStore.shared.invoice(id: id) else { throw AuthFailure.invalidResponse }
        invoice.status = "void"
        PreviewStore.shared.upsert(invoice)
        PreviewStore.shared.appendEvent(invoiceId: id, type: "voided", summary: "Invoice voided")
        return invoice
    }

    func studentInvoices(studentId: String, accessToken: String) async throws -> [PaymentModels.InvoiceResponse] {
        PreviewStore.shared.invoices.filter { $0.studentId == studentId }
    }

    func studentDebt(studentId: String, accessToken: String) async throws -> Double {
        PreviewStore.shared.invoices
            .filter { $0.studentId == studentId && ($0.status == "open" || $0.status == "overdue") }
            .reduce(0.0) { $0 + $1.total }
    }
}
#endif
