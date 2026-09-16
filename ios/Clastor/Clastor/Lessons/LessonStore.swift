import Foundation
import Observation

/// Shared lesson data layer — the mobile counterpart of the web's
/// `["lessons", params]` React Query caches. Serves three read shapes
/// (dashboard full set, calendar window, per-student) plus every mutation;
/// mutation results are applied back into each loaded cache so Home,
/// Calendar and Student detail stay fresh across tabs.
@MainActor
@Observable
final class LessonStore {
    private let api: any LessonServing

    // Dashboard / full-set cache (web: useListLessons() with no params).
    private(set) var allLessons: [LessonModels.LessonResponse] = []
    private(set) var allLoaded = false

    // Calendar window cache (web: ["lessons", {from, to}]).
    private(set) var windowLessons: [LessonModels.LessonResponse] = []
    private(set) var windowLoaded = false
    private(set) var windowFailureMessage: String?
    private var windowKey = ""

    // Per-student caches (web: ["lessons", {studentId}]).
    private(set) var studentLessons: [String: [LessonModels.LessonResponse]] = [:]

    private var isLoading = false

    init() {
        self.api = LessonAPI.live()
    }

    init(api: any LessonServing) {
        self.api = api
    }

    // MARK: Reads

    /// The full unpaginated set used by the dashboard. Fetch once per
    /// session; mutations keep it current via `apply`.
    @discardableResult
    func loadAllIfNeeded(_ session: SessionStore, force: Bool = false) async -> [LessonModels.LessonResponse] {
        if allLoaded && !force { return allLessons }
        guard !isLoading else { return allLessons }
        isLoading = true
        defer { isLoading = false }
        do {
            allLessons = try await session.authenticated { token in
                try await api.list(filters: LessonListFilters(), accessToken: token)
            }
            allLoaded = true
        } catch is CancellationError {
        } catch AuthFailure.cancelled {
        } catch {
        }
        return allLessons
    }

    /// Lessons starting within [from, to) — the calendar's week window.
    /// Cached per window; the same window twice returns the cache (mutations
    /// apply in place, and `create` reloads it). `force` bypasses the cache.
    @discardableResult
    func loadWindow(from: Date, to: Date, _ session: SessionStore, force: Bool = false) async -> [LessonModels.LessonResponse] {
        let key = Self.windowKey(from: from, to: to)
        if !force, windowLoaded, key == windowKey { return windowLessons }
        windowKey = key
        do {
            windowLessons = try await session.authenticated { token in
                try await api.list(filters: LessonListFilters(from: from, to: to), accessToken: token)
            }
            windowLoaded = true
            windowFailureMessage = nil
        } catch is CancellationError {
        } catch AuthFailure.cancelled {
        } catch {
            windowLessons = []
            windowLoaded = false
            windowKey = ""
            windowFailureMessage = AuthFailure.message(for: error)
        }
        return windowLessons
    }

    /// All lessons for one student (stats, detail screens).
    @discardableResult
    func loadStudentLessons(studentId: String, _ session: SessionStore, force: Bool = false) async -> [LessonModels.LessonResponse] {
        if let cached = studentLessons[studentId], !force { return cached }
        do {
            let lessons = try await session.authenticated { token in
                try await api.list(filters: LessonListFilters(studentId: studentId), accessToken: token)
            }
            studentLessons[studentId] = lessons
            return lessons
        } catch is CancellationError {
            return studentLessons[studentId] ?? []
        } catch AuthFailure.cancelled {
            return studentLessons[studentId] ?? []
        } catch {
            return studentLessons[studentId] ?? []
        }
    }

    /// Unpaid lessons for the invoice builder — always fresh (the chargeable
    /// set changes with every attendance record and invoice).
    func loadUnpaid(studentId: String, _ session: SessionStore) async throws -> [LessonModels.LessonResponse] {
        try await session.authenticated { token in
            try await api.list(filters: LessonListFilters(studentId: studentId, unpaid: true), accessToken: token)
        }
    }

    func lesson(id: String) -> LessonModels.LessonResponse? {
        allLessons.first { $0.id == id } ?? windowLessons.first { $0.id == id }
    }

    // MARK: Mutations (wrap the API and keep caches coherent)

    @discardableResult
    func create(_ request: LessonModels.CreateLessonRequest, _ session: SessionStore) async throws -> LessonModels.LessonResponse {
        let created = try await session.authenticated { token in
            try await api.create(request, accessToken: token)
        }
        apply(created)
        await reloadDependents(studentId: created.studentId, session)
        return created
    }

    @discardableResult
    func createRecurring(_ request: LessonModels.CreateRecurringLessonRequest, _ session: SessionStore) async throws -> LessonModels.CreateRecurringLessonResponse {
        let response = try await session.authenticated { token in
            try await api.createRecurring(request, accessToken: token)
        }
        await reloadDependents(studentId: request.studentId, session)
        return response
    }

    @discardableResult
    func update(id: String, _ request: LessonModels.UpdateLessonRequest, _ session: SessionStore) async throws -> LessonModels.LessonResponse {
        let updated = try await session.authenticated { token in
            try await api.update(id: id, request, accessToken: token)
        }
        apply(updated)
        return updated
    }

    @discardableResult
    func reschedule(id: String, _ request: LessonModels.RescheduleLessonRequest, _ session: SessionStore) async throws -> LessonModels.LessonResponse {
        let updated = try await session.authenticated { token in
            try await api.reschedule(id: id, request, accessToken: token)
        }
        apply(updated)
        return updated
    }

    func reschedulePreview(id: String, _ request: LessonModels.RescheduleLessonRequest, _ session: SessionStore) async throws -> LessonModels.EmailPreviewResponse {
        try await session.authenticated { token in
            try await api.reschedulePreview(id: id, request, accessToken: token)
        }
    }

    @discardableResult
    func cancel(id: String, _ request: LessonModels.CancelLessonRequest, _ session: SessionStore) async throws -> LessonModels.LessonResponse {
        let updated = try await session.authenticated { token in
            try await api.cancel(id: id, request, accessToken: token)
        }
        apply(updated)
        return updated
    }

    func cancelPreview(id: String, _ request: LessonModels.CancelLessonRequest, _ session: SessionStore) async throws -> LessonModels.EmailPreviewResponse {
        try await session.authenticated { token in
            try await api.cancelPreview(id: id, request, accessToken: token)
        }
    }

    @discardableResult
    func notifyStudent(id: String, message: String?, _ session: SessionStore) async throws -> LessonModels.LessonResponse {
        let updated = try await session.authenticated { token in
            try await api.notifyStudent(id: id, message: message, accessToken: token)
        }
        apply(updated)
        return updated
    }

    func notifyStudentPreview(id: String, message: String?, _ session: SessionStore) async throws -> LessonModels.EmailPreviewResponse {
        try await session.authenticated { token in
            try await api.notifyStudentPreview(id: id, message: message, accessToken: token)
        }
    }

    @discardableResult
    func recordAttendance(id: String, status: String, _ session: SessionStore) async throws -> LessonModels.LessonResponse {
        let updated = try await session.authenticated { token in
            try await api.recordAttendance(id: id, status: status, accessToken: token)
        }
        apply(updated)
        return updated
    }

    /// Generate a Meet link and persist it on the lesson (the web's
    /// generate-then-PATCH flow). Returns the updated lesson.
    @discardableResult
    func generateMeetLink(for lesson: LessonModels.LessonResponse, _ session: SessionStore) async throws -> LessonModels.LessonResponse {
        let generated = try await session.authenticated { token in
            try await api.generateMeetLink(
                LessonModels.GenerateMeetLinkRequest(
                    lessonId: lesson.id,
                    startDateTime: lesson.startDateTime,
                    durationMinutes: lesson.durationMinutes),
                accessToken: token)
        }
        return try await update(
            id: lesson.id,
            LessonModels.UpdateLessonRequest(location: "Google Meet", meetLink: generated.meetingLink),
            session)
    }

    /// Mark lessons as invoiced after a successful invoice create so every
    /// surface (lesson detail, calendar popover, dashboard to-dos) updates.
    func applyInvoiceCreated(lessonIds: [String], invoiceId: String) {
        for id in lessonIds {
            mutate(id) { lesson in
                lesson.invoiceId = invoiceId
            }
        }
    }

    // MARK: Cache upkeep

    /// Upsert a lesson into every loaded cache.
    func apply(_ updated: LessonModels.LessonResponse) {
        upsert(into: &allLessons, when: allLoaded, lesson: updated)
        upsert(into: &windowLessons, when: windowLoaded, lesson: updated)
        for key in Array(studentLessons.keys) {
            if var list = studentLessons[key] {
                if list.contains(where: { $0.id == updated.id }) || updated.studentId == key {
                    upsert(into: &list, when: true, lesson: updated)
                }
                studentLessons[key] = list
            }
        }
        if windowLoaded {
            // Sort and drop lessons that moved outside the cached window.
            windowLessons.sort {
                (HomeDerivations.date($0.startDateTime) ?? .distantPast) <
                (HomeDerivations.date($1.startDateTime) ?? .distantPast)
            }
            windowLessons = windowLessons.filter { lesson in
                guard let start = HomeDerivations.date(lesson.startDateTime) else { return true }
                if let range = Self.windowKeyDates(from: windowKey) {
                    return start >= range.0 && start < range.1
                }
                return true
            }
        }
    }

    private func mutate(_ id: String, _ transform: (inout LessonModels.LessonResponse) -> Void) {
        if allLoaded, let index = allLessons.firstIndex(where: { $0.id == id }) {
            transform(&allLessons[index])
        }
        if windowLoaded, let index = windowLessons.firstIndex(where: { $0.id == id }) {
            transform(&windowLessons[index])
        }
        for key in Array(studentLessons.keys) {
            if var list = studentLessons[key], let index = list.firstIndex(where: { $0.id == id }) {
                transform(&list[index])
                studentLessons[key] = list
            }
        }
    }

    private func upsert(into list: inout [LessonModels.LessonResponse], when loaded: Bool, lesson: LessonModels.LessonResponse) {
        guard loaded else { return }
        if let index = list.firstIndex(where: { $0.id == lesson.id }) {
            list[index] = lesson
        } else {
            list.append(lesson)
        }
    }

    /// After a create, refresh the caches that could contain new lessons.
    private func reloadDependents(studentId: String, _ session: SessionStore) async {
        if windowLoaded, let range = Self.windowKeyDates(from: windowKey) {
            _ = await loadWindow(from: range.0, to: range.1, session)
        }
        if allLoaded {
            _ = await loadAllIfNeeded(session, force: true)
        }
        if studentLessons[studentId] != nil {
            _ = await loadStudentLessons(studentId: studentId, session, force: true)
        }
    }

    private static func windowKey(from: Date, to: Date) -> String {
        "\(from.timeIntervalSince1970)|\(to.timeIntervalSince1970)"
    }

    private static func windowKeyDates(from key: String) -> (Date, Date)? {
        let parts = key.split(separator: "|").compactMap { Double($0) }
        guard parts.count == 2 else { return nil }
        return (Date(timeIntervalSince1970: parts[0]), Date(timeIntervalSince1970: parts[1]))
    }
}
