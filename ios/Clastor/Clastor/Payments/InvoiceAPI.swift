import Foundation

/// Hand-written request bodies for POST /api/payments (the YAML uses inline
/// line-item objects the Swift generator intentionally rejects). Mirrors the
/// backend's createInvoiceSchema, including the required `description`.
struct CreateInvoiceLineItemBody: Codable, Equatable, Sendable {
    var lessonId: String
    var description: String
    var durationMinutes: Int
    var rateType: String
    var unitAmount: Double
    var quantity: Double
}

struct CreateInvoiceBody: Codable, Equatable, Sendable {
    var studentId: String
    var lineItems: [CreateInvoiceLineItemBody]
    var billingEmail: String? = nil
    var dueDate: String
    var paymentMethod: String
    var issueDate: String? = nil
    var status: String? = nil
    var notes: String? = nil
}

struct InvoiceMessageBody: Codable, Equatable, Sendable {
    var message: String?
}

/// Debt snapshot from GET /api/payments/student/:id/debt.
struct StudentDebtResponse: Codable, Equatable, Sendable {
    var total: Double
}

@MainActor
protocol InvoiceServing {
    func list(status: String?, search: String?, accessToken: String) async throws -> [PaymentModels.InvoiceResponse]
    func invoice(id: String, accessToken: String) async throws -> PaymentModels.InvoiceResponse
    func events(id: String, accessToken: String) async throws -> [PaymentModels.InvoiceEventResponse]
    func create(_ body: CreateInvoiceBody, accessToken: String) async throws -> PaymentModels.InvoiceResponse
    func send(id: String, message: String?, accessToken: String) async throws -> PaymentModels.InvoiceResponse
    func sendPreview(id: String, message: String?, accessToken: String) async throws -> LessonModels.EmailPreviewResponse
    func markPaid(id: String, accessToken: String) async throws -> PaymentModels.InvoiceResponse
    func void(id: String, accessToken: String) async throws -> PaymentModels.InvoiceResponse
    func studentInvoices(studentId: String, accessToken: String) async throws -> [PaymentModels.InvoiceResponse]
    func studentDebt(studentId: String, accessToken: String) async throws -> Double
}

@MainActor
final class InvoiceAPI: InvoiceServing {
    private let client: BackendClient

    init(origin: URL, session: URLSession? = nil) {
        client = BackendClient(origin: origin, session: session)
    }

    static func live() -> any InvoiceServing {
        #if DEBUG
        if AuthPreviewSupport.isUITesting || AuthPreviewSupport.isPreview {
            return AuthPreviewSupport.invoiceAPI()
        }
        #endif
        guard let configuration = try? AppConfiguration.load() else {
            preconditionFailure("App configuration is invalid. Check the selected scheme.")
        }
        return InvoiceAPI(origin: configuration.apiBaseURL)
    }

    func list(status: String?, search: String?, accessToken: String) async throws -> [PaymentModels.InvoiceResponse] {
        var query: [URLQueryItem] = []
        if let status, status != "all" { query.append(URLQueryItem(name: "status", value: status)) }
        if let search, !search.isEmpty { query.append(URLQueryItem(name: "search", value: search)) }
        let response: PaymentModels.InvoiceListResponse = try client.decode(
            await client.send(path: "api/payments", query: query, method: "GET", bearer: accessToken)
        )
        return response.data
    }

    func invoice(id: String, accessToken: String) async throws -> PaymentModels.InvoiceResponse {
        try client.decode(await client.send(path: "api/payments/\(id)", method: "GET", bearer: accessToken))
    }

    func events(id: String, accessToken: String) async throws -> [PaymentModels.InvoiceEventResponse] {
        let response: PaymentModels.InvoiceEventListResponse = try client.decode(
            await client.send(path: "api/payments/\(id)/events", method: "GET", bearer: accessToken)
        )
        return response.data
    }

    func create(_ body: CreateInvoiceBody, accessToken: String) async throws -> PaymentModels.InvoiceResponse {
        try client.decode(
            await client.send(path: "api/payments", method: "POST", bearer: accessToken,
                              body: try JSONEncoder().encode(body))
        )
    }

    func send(id: String, message: String?, accessToken: String) async throws -> PaymentModels.InvoiceResponse {
        try client.decode(
            await client.send(path: "api/payments/\(id)/send", method: "POST", bearer: accessToken,
                              body: try JSONEncoder().encode(InvoiceMessageBody(message: message)))
        )
    }

    func sendPreview(id: String, message: String?, accessToken: String) async throws -> LessonModels.EmailPreviewResponse {
        try client.decode(
            await client.send(path: "api/payments/\(id)/send/preview", method: "POST", bearer: accessToken,
                              body: try JSONEncoder().encode(InvoiceMessageBody(message: message)))
        )
    }

    func markPaid(id: String, accessToken: String) async throws -> PaymentModels.InvoiceResponse {
        try client.decode(
            await client.send(path: "api/payments/\(id)/mark-paid", method: "POST", bearer: accessToken,
                              body: try JSONEncoder().encode(PaymentModels.MarkPaidRequest()))
        )
    }

    func void(id: String, accessToken: String) async throws -> PaymentModels.InvoiceResponse {
        try client.decode(
            await client.send(path: "api/payments/\(id)/void", method: "POST", bearer: accessToken)
        )
    }

    func studentInvoices(studentId: String, accessToken: String) async throws -> [PaymentModels.InvoiceResponse] {
        let response: PaymentModels.InvoiceListResponse = try client.decode(
            await client.send(path: "api/payments/student/\(studentId)/invoices", method: "GET", bearer: accessToken)
        )
        return response.data
    }

    func studentDebt(studentId: String, accessToken: String) async throws -> Double {
        let response: StudentDebtResponse = try client.decode(
            await client.send(path: "api/payments/student/\(studentId)/debt", method: "GET", bearer: accessToken)
        )
        return response.total
    }
}
