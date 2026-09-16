// Generated from interfaces/src/openapi.yaml. Do not edit.
// Regenerate: npm run build:swift-payments --workspace=interfaces

nonisolated enum PaymentModels {
    // src/schemas/payments/res/InvoiceListResponse.yaml
    struct `InvoiceListResponse`: Codable, Equatable, Sendable {
        var `data`: [`InvoiceResponse`]
        var `total`: Int? = nil
        var `nextCursor`: String? = nil
        var `hasMore`: Bool
    }

    // src/schemas/payments/res/InvoiceEventListResponse.yaml
    struct `InvoiceEventListResponse`: Codable, Equatable, Sendable {
        var `data`: [`InvoiceEventResponse`]
        var `total`: Int
    }

    // src/schemas/payments/req/MarkPaidRequest.yaml
    struct `MarkPaidRequest`: Codable, Equatable, Sendable {
        var `paymentMethod`: `PaymentMethod`? = nil
        var `paidAt`: String? = nil
    }

    // src/schemas/payments/res/InvoiceResponse.yaml
    struct `InvoiceResponse`: Codable, Equatable, Sendable {
        var `id`: String
        var `invoiceNumber`: String
        var `tutorId`: String
        var `studentId`: String
        var `customerName`: String
        var `billingEmail`: String? = nil
        var `status`: `InvoiceStatus`
        var `currency`: String
        var `lineItems`: [`InvoiceLineItem`]
        var `subtotal`: Double
        var `total`: Double
        var `paymentMethod`: `PaymentMethod`
        var `issueDate`: String
        var `dueDate`: String
        var `paidAt`: String? = nil
        var `sentAt`: String? = nil
        var `notes`: String? = nil
        var `stripePaymentIntentId`: String? = nil
        var `createdAt`: String
        var `updatedAt`: String
        var `tutorName`: String? = nil
        var `tutorEmail`: String? = nil
    }

    // src/schemas/payments/res/InvoiceEventResponse.yaml
    struct `InvoiceEventResponse`: Codable, Equatable, Sendable {
        var `id`: String
        var `invoiceId`: String
        var `type`: `InvoiceEventType`
        var `summary`: String
        var `actorName`: String? = nil
        var `timestamp`: String
    }

    // src/schemas/payments/PaymentMethod.yaml
    typealias `PaymentMethod` = String

    // src/schemas/payments/InvoiceStatus.yaml
    typealias `InvoiceStatus` = String

    // src/schemas/payments/InvoiceLineItem.yaml
    struct `InvoiceLineItem`: Codable, Equatable, Sendable {
        var `lessonId`: String
        var `description`: String
        var `durationMinutes`: Int
        var `rateType`: `RateType`
        var `unitAmount`: Double
        var `quantity`: Double
        var `amount`: Double
    }

    // src/schemas/payments/InvoiceEventType.yaml
    typealias `InvoiceEventType` = String

    // src/schemas/students/RateType.yaml
    typealias `RateType` = String
}
