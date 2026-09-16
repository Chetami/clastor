import Foundation

@MainActor
protocol StudentsServing {
    func list(accessToken: String) async throws -> [StudentModels.StudentResponse]
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
            return AuthPreviewSupport.studentsAPI()
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
}
