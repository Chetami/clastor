import Foundation
import Testing
@testable import Clastor

@MainActor
struct StoreTests {
    // MARK: Fakes

    private final class FakeStudentsAPI: StudentsServing {
        var fetchCount = 0
        var students: [StudentModels.StudentResponse] = []
        func list(accessToken: String) async throws -> [StudentModels.StudentResponse] {
            fetchCount += 1
            return students
        }
        func student(id: String, accessToken: String) async throws -> StudentModels.StudentResponse {
            students.first { $0.id == id } ?? students[0]
        }
        func create(_ request: StudentModels.CreateStudentRequest, accessToken: String) async throws -> StudentModels.StudentResponse { students[0] }
        func update(id: String, _ request: StudentModels.UpdateStudentRequest, accessToken: String) async throws -> StudentModels.StudentResponse {
            students.first { $0.id == id } ?? students[0]
        }
    }

    private final class FakeLessonAPI: LessonServing {
        var fetchCount = 0
        var lessons: [LessonModels.LessonResponse] = []
        private func iso(_ minutesFromNow: Double) -> String {
            ISO8601DateFormatter().string(from: Date().addingTimeInterval(minutesFromNow * 60))
        }
        func list(filters: LessonListFilters, accessToken: String) async throws -> [LessonModels.LessonResponse] {
            fetchCount += 1
            if let from = filters.from {
                return lessons.filter {
                    guard let start = HomeDerivations.date($0.startDateTime) else { return false }
                    return start >= from && (filters.to.map { start < $0 } ?? true)
                }
            }
            return lessons
        }
        func lesson(id: String, accessToken: String) async throws -> LessonModels.LessonResponse { lessons[0] }
        func create(_ request: LessonModels.CreateLessonRequest, accessToken: String) async throws -> LessonModels.LessonResponse { lessons[0] }
        func createRecurring(_ request: LessonModels.CreateRecurringLessonRequest, accessToken: String) async throws -> LessonModels.CreateRecurringLessonResponse {
            LessonModels.CreateRecurringLessonResponse(seriesId: "s", count: 1)
        }
        func update(id: String, _ request: LessonModels.UpdateLessonRequest, accessToken: String) async throws -> LessonModels.LessonResponse {
            guard let index = lessons.firstIndex(where: { $0.id == id }) else { return lessons[0] }
            var lesson = lessons[index]
            if let subject = request.subject { lesson.subject = subject }
            if let attendanceStatus = request.todos { lesson.todos = attendanceStatus }
            if request.notes != nil { lesson.notes = request.notes }
            if let duration = request.durationMinutes { lesson.durationMinutes = duration }
            lessons[index] = lesson
            return lesson
        }
        func reschedule(id: String, _ request: LessonModels.RescheduleLessonRequest, accessToken: String) async throws -> LessonModels.LessonResponse {
            guard let index = lessons.firstIndex(where: { $0.id == id }) else { return lessons[0] }
            lessons[index].startDateTime = request.startDateTime
            return lessons[index]
        }
        func reschedulePreview(id: String, _ request: LessonModels.RescheduleLessonRequest, accessToken: String) async throws -> LessonModels.EmailPreviewResponse {
            PreviewStore.shared.emailPreview(subject: "s", to: [], message: nil)
        }
        func cancel(id: String, _ request: LessonModels.CancelLessonRequest, accessToken: String) async throws -> LessonModels.LessonResponse {
            guard let index = lessons.firstIndex(where: { $0.id == id }) else { return lessons[0] }
            lessons[index].isCancelled = true
            return lessons[index]
        }
        func cancelPreview(id: String, _ request: LessonModels.CancelLessonRequest, accessToken: String) async throws -> LessonModels.EmailPreviewResponse {
            PreviewStore.shared.emailPreview(subject: "s", to: [], message: nil)
        }
        func notifyStudent(id: String, message: String?, accessToken: String) async throws -> LessonModels.LessonResponse { lessons[0] }
        func notifyStudentPreview(id: String, message: String?, accessToken: String) async throws -> LessonModels.EmailPreviewResponse {
            PreviewStore.shared.emailPreview(subject: "s", to: [], message: nil)
        }
        func recordAttendance(id: String, status: String, accessToken: String) async throws -> LessonModels.LessonResponse {
            guard let index = lessons.firstIndex(where: { $0.id == id }) else { return lessons[0] }
            lessons[index].attendanceStatus = status
            return lessons[index]
        }
        func generateMeetLink(_ request: LessonModels.GenerateMeetLinkRequest, accessToken: String) async throws -> LessonModels.GenerateMeetLinkResponse {
            LessonModels.GenerateMeetLinkResponse(meetingLink: "https://meet.example/x", calendarEventId: "e")
        }
    }

    private final class FakeInvoiceAPI: InvoiceServing {
        struct Call {
            var cursor: String?
            var limit: Int?
        }
        var calls: [Call] = []
        var debtFetchCount = 0
        var page1: PaymentModels.InvoiceListResponse
        var page2: PaymentModels.InvoiceListResponse

        init() {
            let invoice = { (id: String) in
                PaymentModels.InvoiceResponse(
                    id: id, invoiceNumber: "INV-\(id)", tutorId: "t", studentId: "student-1",
                    customerName: "Alex", billingEmail: "a@x.test", status: "open", currency: "AUD",
                    lineItems: [], subtotal: 10, total: 10, paymentMethod: "bank_transfer",
                    issueDate: "2026-01-01T00:00:00Z", dueDate: "2026-01-15T00:00:00Z",
                    createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z")
            }
            page1 = .init(data: [invoice("1"), invoice("2")], total: 4, nextCursor: "page-2", hasMore: true)
            page2 = .init(data: [invoice("3"), invoice("4")], total: 4, nextCursor: nil, hasMore: false)
        }

        func list(status: String?, search: String?, limit: Int?, cursor: String?, accessToken: String) async throws -> PaymentModels.InvoiceListResponse {
            calls.append(Call(cursor: cursor, limit: limit))
            return cursor == nil ? page1 : page2
        }
        func invoice(id: String, accessToken: String) async throws -> PaymentModels.InvoiceResponse { page1.data[0] }
        func events(id: String, accessToken: String) async throws -> [PaymentModels.InvoiceEventResponse] { [] }
        func create(_ body: CreateInvoiceBody, accessToken: String) async throws -> PaymentModels.InvoiceResponse { page1.data[0] }
        func send(id: String, message: String?, accessToken: String) async throws -> PaymentModels.InvoiceResponse {
            var sent = page1.data[0]
            sent.status = "open"
            sent.sentAt = "2026-01-02T00:00:00Z"
            return sent
        }
        func sendPreview(id: String, message: String?, accessToken: String) async throws -> LessonModels.EmailPreviewResponse {
            PreviewStore.shared.emailPreview(subject: "i", to: ["a@x.test"], message: nil)
        }
        func markPaid(id: String, accessToken: String) async throws -> PaymentModels.InvoiceResponse {
            var paid = page1.data[0]
            paid.status = "paid"
            return paid
        }
        func void(id: String, accessToken: String) async throws -> PaymentModels.InvoiceResponse {
            var voided = page1.data[0]
            voided.status = "void"
            return voided
        }
        func studentInvoices(studentId: String, accessToken: String) async throws -> [PaymentModels.InvoiceResponse] { page1.data }
        func studentDebt(studentId: String, accessToken: String) async throws -> Double {
            debtFetchCount += 1
            return 42
        }
    }

    /// A session that is signed in via the offline preview auth fakes
    /// (restore alone leaves it signedOut — no stored credentials).
    private func makeSession() async -> SessionStore {
        let session = AuthPreviewSupport.session()
        await session.restore()
        await session.signIn(email: "tutor@example.test", password: "password")
        return session
    }

    private func lesson(id: String, minutesFromNow: Double) -> LessonModels.LessonResponse {
        LessonModels.LessonResponse(
            id: id, studentId: "student-1", subject: "Mathematics",
            startDateTime: ISO8601DateFormatter().string(from: Date().addingTimeInterval(minutesFromNow * 60)),
            durationMinutes: 60, acceptanceStatus: "accepted", attendanceStatus: "unrecorded",
            remindersEnabled: true, isPaid: false,
            createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z")
    }

    // MARK: StudentStore

    @Test func studentStoreFetchesOnceAndUpserts() async throws {
        let api = FakeStudentsAPI()
        api.students = [StudentModels.StudentResponse(
            id: "student-1", name: "Alex", billingEmailSource: "student", subjectIds: [],
            expectedAmount: 60, rateType: "hourly", frequencyPerWeek: 1, status: "active",
            amountOwed: 0, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z")]
        let store = StudentStore(api: api)
        let session = await makeSession()

        await store.loadIfNeeded(session)
        await store.loadIfNeeded(session)
        #expect(api.fetchCount == 1)
        #expect(store.namesByID["student-1"] == "Alex")

        var renamed = api.students[0]
        renamed.name = "Alexander"
        store.apply(renamed)
        #expect(store.student(id: "student-1")?.name == "Alexander")
    }

    // MARK: LessonStore

    @Test func lessonStoreCachesFullSetAndAppliesMutations() async throws {
        let api = FakeLessonAPI()
        api.lessons = [lesson(id: "one", minutesFromNow: -60), lesson(id: "two", minutesFromNow: 60)]
        let store = LessonStore(api: api)
        let session = await makeSession()

        await store.loadAllIfNeeded(session)
        await store.loadAllIfNeeded(session)
        #expect(api.fetchCount == 1)
        #expect(store.allLessons.count == 2)

        let updated = try await store.recordAttendance(id: "one", status: "present", session)
        #expect(updated.attendanceStatus == "present")
        #expect(store.allLessons.first { $0.id == "one" }?.attendanceStatus == "present")
    }

    @Test func lessonStoreWindowDropsRescheduledOutliers() async throws {
        let api = FakeLessonAPI()
        api.lessons = [lesson(id: "in-window", minutesFromNow: 60)]
        let store = LessonStore(api: api)
        let session = await makeSession()

        await store.loadWindow(from: Date(), to: Date().addingTimeInterval(86_400), session)
        #expect(store.windowLessons.map(\.id) == ["in-window"])

        // A lesson rescheduled far outside the cached window is dropped.
        var moved = lesson(id: "in-window", minutesFromNow: 60)
        moved.startDateTime = ISO8601DateFormatter().string(from: Date().addingTimeInterval(30 * 86_400))
        store.apply(moved)
        #expect(store.windowLessons.isEmpty)
    }

    // MARK: InvoiceStore

    @Test func invoiceStorePaginatesAndResetsOnFilterChange() async throws {
        let api = FakeInvoiceAPI()
        let store = InvoiceStore(api: api)
        let session = await makeSession()

        await store.refresh(session)
        #expect(store.invoices.map(\.id) == ["1", "2"])
        #expect(store.hasMore)

        await store.loadMore(session)
        #expect(store.invoices.map(\.id) == ["1", "2", "3", "4"])
        #expect(!store.hasMore)
        // Exhausted cursor: further loadMore must not call the API.
        let callCount = api.calls.count
        await store.loadMore(session)
        #expect(api.calls.count == callCount)

        // A filter change resets the cursor chain.
        _ = await store.setFilter("paid", session)
        #expect(api.calls.last?.cursor == nil)
        #expect(store.statusFilter == "paid")
    }

    @Test func invoiceStoreAppliesMutationsIntoTheList() async throws {
        let api = FakeInvoiceAPI()
        let store = InvoiceStore(api: api)
        let session = await makeSession()

        await store.refresh(session)
        await store.loadStudentDebt(studentId: "student-1", session)
        await store.loadStudentInvoices(studentId: "student-1", session)
        await store.loadStudentDebt(studentId: "student-1", session)
        #expect(api.debtFetchCount == 1)  // cached between reads

        let paid = try await store.markPaid(id: "1", session)
        #expect(paid.status == "paid")
        #expect(store.invoices.first { $0.id == "1" }?.status == "paid")
        // The mutation invalidated the student snapshot — reloading refetches.
        await store.loadStudentDebt(studentId: "student-1", session)
        #expect(api.debtFetchCount == 2)
    }
}
