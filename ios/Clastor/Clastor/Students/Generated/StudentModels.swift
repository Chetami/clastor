// Generated from interfaces/src/openapi.yaml. Do not edit.
// Regenerate: npm run build:swift-students --workspace=interfaces

nonisolated enum StudentModels {
    // src/schemas/students/res/StudentListResponse.yaml
    struct `StudentListResponse`: Codable, Equatable, Sendable {
        var `data`: [`StudentResponse`]
        var `total`: Int
    }

    // src/schemas/students/req/CreateStudentRequest.yaml
    struct `CreateStudentRequest`: Codable, Equatable, Sendable {
        var `name`: String
        var `email`: String? = nil
        var `phone`: String? = nil
        var `parentEmail`: String? = nil
        var `billingEmail`: String? = nil
        var `subjectIds`: [String]
        var `expectedAmount`: Double
        var `rateType`: `RateType`
        var `frequencyPerWeek`: Int
        var `status`: `StudentStatus`? = nil
        var `timezone`: String? = nil
        var `notes`: String? = nil
    }

    // src/schemas/students/req/UpdateStudentRequest.yaml
    struct `UpdateStudentRequest`: Codable, Equatable, Sendable {
        var `name`: String? = nil
        var `email`: String? = nil
        var `phone`: String? = nil
        var `parentEmail`: String? = nil
        var `billingEmail`: String? = nil
        var `subjectIds`: [String]? = nil
        var `expectedAmount`: Double? = nil
        var `rateType`: `RateType`? = nil
        var `frequencyPerWeek`: Int? = nil
        var `status`: `StudentStatus`? = nil
        var `timezone`: String? = nil
        var `notes`: String? = nil
    }

    // src/schemas/students/res/StudentResponse.yaml
    struct `StudentResponse`: Codable, Equatable, Sendable {
        var `id`: String
        var `name`: String
        var `email`: String? = nil
        var `phone`: String? = nil
        var `parentEmail`: String? = nil
        var `billingEmail`: String? = nil
        var `billingEmailSource`: `BillingEmailSource`
        var `subjectIds`: [String]
        var `expectedAmount`: Double
        var `rateType`: `RateType`
        var `frequencyPerWeek`: Int
        var `status`: `StudentStatus`
        var `timezone`: String? = nil
        var `notes`: String? = nil
        var `amountOwed`: Double
        var `createdAt`: String
        var `updatedAt`: String
        var `tutorName`: String? = nil
        var `tutorEmail`: String? = nil
    }

    // src/schemas/students/RateType.yaml
    typealias `RateType` = String

    // src/schemas/students/StudentStatus.yaml
    typealias `StudentStatus` = String

    // src/schemas/students/BillingEmailSource.yaml
    typealias `BillingEmailSource` = String
}
