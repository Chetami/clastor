#if DEBUG
import Foundation

// Invoices preview fake — reads and mutates the shared PreviewStore.
@MainActor
enum InvoicePreviewSupport {

@MainActor
static func api() -> any InvoiceServing { PreviewInvoiceAPI(mode: AuthPreviewSupport.activeScenario) }

private final class PreviewInvoiceAPI: InvoiceServing {
    let mode: String
    init(mode: String) { self.mode = mode }

    func list(status: String?, search: String?, limit: Int?, cursor: String?, accessToken: String) async throws -> PaymentModels.InvoiceListResponse {
        if mode == "invoices-unavailable" { throw AuthFailure.network }
        let filtered = PreviewStore.shared.invoices.filter { invoice in
            if let status, status != "all", status != "overdue", invoice.status != status { return false }
            if let status, status == "overdue", !(invoice.status == "open" && InvoiceDerivations.isOverdue(invoice)) { return false }
            return true
        }
        guard let limit else {
            return PaymentModels.InvoiceListResponse(data: filtered, total: filtered.count, nextCursor: nil, hasMore: false)
        }
        // Cursor encodes the offset so pagination flows work in UI tests.
        let offset = cursor.flatMap { Int($0.dropFirst("offset:".count)) } ?? 0
        let end = min(offset + limit, filtered.count)
        let page = Array(filtered[offset..<end])
        let next = end < filtered.count ? "offset:\(end)" : nil
        return PaymentModels.InvoiceListResponse(data: page, total: filtered.count, nextCursor: next, hasMore: next != nil)
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
}
#endif
