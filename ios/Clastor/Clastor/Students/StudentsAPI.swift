import Foundation

@MainActor
protocol StudentsServing {
    func list(accessToken: String) async throws -> [StudentModels.StudentResponse]
    func student(id: String, accessToken: String) async throws -> StudentModels.StudentResponse
    func create(_ request: StudentModels.CreateStudentRequest, accessToken: String) async throws -> StudentModels.StudentResponse
    func update(id: String, _ request: StudentModels.UpdateStudentRequest, accessToken: String) async throws -> StudentModels.StudentResponse
}

@MainActor
final class StudentsAPI: StudentsServing {
    private let client: BackendClient

    init(origin: URL, session: URLSession? = nil) {
        client = BackendClient(origin: origin, session: session)
    }

    static func live() -> any StudentsServing {
        #if DEBUG
        if AuthPreviewSupport.isUITesting || AuthPreviewSupport.isPreview {
            return StudentsPreviewSupport.api()
        }
        #endif
        guard let configuration = try? AppConfiguration.load() else {
            preconditionFailure("App configuration is invalid. Check the selected scheme.")
        }
        return StudentsAPI(origin: configuration.apiBaseURL)
    }

    func list(accessToken: String) async throws -> [StudentModels.StudentResponse] {
        let response: StudentModels.StudentListResponse = try client.decode(
            await client.send(path: "api/students", method: "GET", bearer: accessToken)
        )
        return response.data
    }

    func student(id: String, accessToken: String) async throws -> StudentModels.StudentResponse {
        try client.decode(await client.send(path: "api/students/id/\(id)", method: "GET", bearer: accessToken))
    }

    func create(_ request: StudentModels.CreateStudentRequest, accessToken: String) async throws -> StudentModels.StudentResponse {
        try client.decode(
            await client.send(path: "api/students", method: "POST", bearer: accessToken,
                              body: try JSONEncoder().encode(request))
        )
    }

    func update(id: String, _ request: StudentModels.UpdateStudentRequest, accessToken: String) async throws -> StudentModels.StudentResponse {
        try client.decode(
            await client.send(path: "api/students/\(id)", method: "PUT", bearer: accessToken,
                              body: try JSONEncoder().encode(request))
        )
    }
}
