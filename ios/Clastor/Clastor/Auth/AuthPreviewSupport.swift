#if DEBUG
import Foundation

// Offline dependencies for previews and UI tests. No real Firebase, API or
// Keychain is reachable through this session. Omitted from Release builds.
// This file is the hub: session fixtures + the shared PreviewStore all
// feature preview APIs read from and mutate. Per-feature API fakes live in
// <Feature>/<Feature>PreviewSupport.swift.
@MainActor
enum AuthPreviewSupport {
    static var isUITesting: Bool { ProcessInfo.processInfo.arguments.contains("--auth-ui-test") }
    static var isPreview: Bool { ProcessInfo.processInfo.environment["XCODE_RUNNING_FOR_PREVIEWS"] == "1" }

    /// The active AUTH_TEST_SCENARIO; per-feature preview fakes read it.
    static var activeScenario: String {
        ProcessInfo.processInfo.environment["AUTH_TEST_SCENARIO"] ?? "success"
    }

    static func session() -> SessionStore {
        let mode = activeScenario
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
#endif
