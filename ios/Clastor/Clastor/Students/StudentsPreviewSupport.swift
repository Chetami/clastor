#if DEBUG
import Foundation

// Students preview fake — reads and mutates the shared PreviewStore so
// mutations surface in every tab during previews and UI tests.
@MainActor
enum StudentsPreviewSupport {

@MainActor
static func api() -> any StudentsServing { PreviewStudentsAPI(mode: AuthPreviewSupport.activeScenario) }

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
}
#endif
