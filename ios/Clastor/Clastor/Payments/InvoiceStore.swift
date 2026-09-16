import Foundation
import Observation

/// Shared invoice data layer — the mobile counterpart of the web's
/// `["invoices", ...]` React Query caches. The payments list is
/// cursor-paginated (filter changes reset the cursor chain); per-student
/// debt/invoice snapshots are cached and invalidated by mutations.
@MainActor
@Observable
final class InvoiceStore {
    static let pageSize = 20

    private let api: any InvoiceServing

    // Paginated list (Payments tab)
    private(set) var invoices: [PaymentModels.InvoiceResponse] = []
    private(set) var statusFilter = "all"
    private(set) var nextCursor: String?
    private(set) var isListLoaded = false
    private(set) var isListLoading = false
    private(set) var isLoadingMore = false
    private(set) var failureMessage: String?

    // Student-scoped snapshots (Student detail)
    private var studentInvoicesCache: [String: [PaymentModels.InvoiceResponse]] = [:]
    private var studentDebtCache: [String: Double] = [:]

    init() {
        self.api = InvoiceAPI.live()
    }

    init(api: any InvoiceServing) {
        self.api = api
    }

    var hasMore: Bool { nextCursor != nil }

    // MARK: Paginated list

    /// Reset to page one for the (new) filter and fetch.
    @discardableResult
    func setFilter(_ status: String, _ session: SessionStore) async -> [PaymentModels.InvoiceResponse] {
        guard status != statusFilter || !isListLoaded else { return invoices }
        statusFilter = status
        nextCursor = nil
        return await refresh(session)
    }

    @discardableResult
    func refresh(_ session: SessionStore) async -> [PaymentModels.InvoiceResponse] {
        guard !isListLoading else { return invoices }
        isListLoading = true
        failureMessage = nil
        defer { isListLoading = false }
        do {
            let status = statusFilter
            let page = try await session.authenticated { token in
                try await api.list(status: status, search: nil, limit: Self.pageSize, cursor: nil, accessToken: token)
            }
            invoices = page.data
            nextCursor = page.nextCursor
            isListLoaded = true
        } catch is CancellationError {
        } catch AuthFailure.cancelled {
        } catch {
            if !isListLoaded {
                invoices = []
                failureMessage = AuthFailure.message(for: error)
            }
        }
        return invoices
    }

    /// Append the next page (no-op when the cursor chain is exhausted).
    @discardableResult
    func loadMore(_ session: SessionStore) async -> [PaymentModels.InvoiceResponse] {
        guard let cursor = nextCursor, !isListLoading, !isLoadingMore else { return invoices }
        isLoadingMore = true
        defer { isLoadingMore = false }
        do {
            let status = statusFilter
            let page = try await session.authenticated { token in
                try await api.list(status: status, search: nil, limit: Self.pageSize, cursor: cursor, accessToken: token)
            }
            invoices.append(contentsOf: page.data)
            nextCursor = page.nextCursor
        } catch is CancellationError {
        } catch AuthFailure.cancelled {
        } catch {
            // Keep the loaded pages; the user can scroll again to retry.
        }
        return invoices
    }

    /// Loads page one only if nothing has been fetched yet (tab's first
    /// appearance); otherwise mutations have kept the list current.
    @discardableResult
    func loadIfNeeded(_ session: SessionStore) async -> [PaymentModels.InvoiceResponse] {
        if isListLoaded { return invoices }
        return await refresh(session)
    }

    // MARK: Student-scoped reads

    @discardableResult
    func loadStudentInvoices(studentId: String, _ session: SessionStore, force: Bool = false) async -> [PaymentModels.InvoiceResponse] {
        if let cached = studentInvoicesCache[studentId], !force { return cached }
        do {
            let invoices = try await session.authenticated { token in
                try await api.studentInvoices(studentId: studentId, accessToken: token)
            }
            studentInvoicesCache[studentId] = invoices
            return invoices
        } catch is CancellationError {
            return studentInvoicesCache[studentId] ?? []
        } catch AuthFailure.cancelled {
            return studentInvoicesCache[studentId] ?? []
        } catch {
            return studentInvoicesCache[studentId] ?? []
        }
    }

    @discardableResult
    func loadStudentDebt(studentId: String, _ session: SessionStore, force: Bool = false) async -> Double? {
        if let cached = studentDebtCache[studentId], !force { return cached }
        do {
            let total = try await session.authenticated { token in
                try await api.studentDebt(studentId: studentId, accessToken: token)
            }
            studentDebtCache[studentId] = total
            return total
        } catch is CancellationError {
            return studentDebtCache[studentId]
        } catch AuthFailure.cancelled {
            return studentDebtCache[studentId]
        } catch {
            return studentDebtCache[studentId]
        }
    }

    // MARK: Mutations (wrap the API and keep caches coherent)

    @discardableResult
    func create(_ body: CreateInvoiceBody, _ session: SessionStore) async throws -> PaymentModels.InvoiceResponse {
        let created = try await session.authenticated { token in
            try await api.create(body, accessToken: token)
        }
        invalidateStudentCaches(studentId: body.studentId)
        if isListLoaded {
            // Background refresh so the Payments tab reflects the new invoice.
            Task { await refresh(session) }
        }
        return created
    }

    @discardableResult
    func send(id: String, message: String?, _ session: SessionStore) async throws -> PaymentModels.InvoiceResponse {
        let updated = try await session.authenticated { token in
            try await api.send(id: id, message: message, accessToken: token)
        }
        apply(updated)
        return updated
    }

    func sendPreview(id: String, message: String?, _ session: SessionStore) async throws -> LessonModels.EmailPreviewResponse {
        try await session.authenticated { token in
            try await api.sendPreview(id: id, message: message, accessToken: token)
        }
    }

    @discardableResult
    func markPaid(id: String, _ session: SessionStore) async throws -> PaymentModels.InvoiceResponse {
        let updated = try await session.authenticated { token in
            try await api.markPaid(id: id, accessToken: token)
        }
        apply(updated)
        invalidateStudentCaches(studentId: updated.studentId)
        return updated
    }

    @discardableResult
    func void(id: String, _ session: SessionStore) async throws -> PaymentModels.InvoiceResponse {
        let updated = try await session.authenticated { token in
            try await api.void(id: id, accessToken: token)
        }
        apply(updated)
        invalidateStudentCaches(studentId: updated.studentId)
        return updated
    }

    // MARK: Cache upkeep

    /// Upsert into the list (if loaded) and drop stale student snapshots.
    func apply(_ updated: PaymentModels.InvoiceResponse) {
        if isListLoaded {
            if let index = invoices.firstIndex(where: { $0.id == updated.id }) {
                invoices[index] = updated
            }
        }
        invalidateStudentCaches(studentId: updated.studentId)
    }

    func invalidateStudentCaches(studentId: String) {
        studentInvoicesCache[studentId] = nil
        studentDebtCache[studentId] = nil
    }

    func invalidateList() {
        isListLoaded = false
        nextCursor = nil
    }
}
