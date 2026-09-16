#if DEBUG
import Foundation

// Offline dependencies for previews and UI tests. No real Firebase, API or
// Keychain is reachable through this session. Omitted from Release builds.
@MainActor
enum AuthPreviewSupport {
    static var isUITesting: Bool { ProcessInfo.processInfo.arguments.contains("--auth-ui-test") }
    static var isPreview: Bool { ProcessInfo.processInfo.environment["XCODE_RUNNING_FOR_PREVIEWS"] == "1" }

    static func studentsAPI() -> any StudentsServing {
        PreviewStudentsAPI(mode: ProcessInfo.processInfo.environment["AUTH_TEST_SCENARIO"] ?? "success")
    }

    static func homeAPI() -> any HomeServing {
        PreviewHomeAPI(mode: ProcessInfo.processInfo.environment["AUTH_TEST_SCENARIO"] ?? "success")
    }

    static func session() -> SessionStore {
        let mode = ProcessInfo.processInfo.environment["AUTH_TEST_SCENARIO"] ?? "success"
        return SessionStore(appName: "Clastor", identity: PreviewIdentity(reject: mode == "invalid-password"),
                            api: PreviewAPI(unavailable: mode == "backend-unavailable"), storage: PreviewStorage())
    }
}

@MainActor
private final class PreviewIdentity: FirebaseSigningIn {
    let reject: Bool
    init(reject: Bool) { self.reject = reject }
    func signIn(email: String, password: String) async throws -> String {
        if reject { throw AuthFailure.invalidCredentials }
        return "offline-preview-identity"
    }
    func signOut() throws {}
}

@MainActor
private final class PreviewAPI: AuthServing {
    let unavailable: Bool
    let user = AuthModels.UserInfo(uid: "preview-user", name: "Test Tutor", email: "tutor@example.test", role: "tutor", emailVerified: true, onboardingComplete: true, tourSeen: true)
    init(unavailable: Bool) { self.unavailable = unavailable }
    func login(firebaseIDToken: String) async throws -> AuthModels.LoginResponse {
        if unavailable { throw AuthFailure.http(503) }
        return .init(jwtToken: "offline-preview-access", refreshToken: "offline-preview-refresh", user: user)
    }
    func verify(accessToken: String) async throws -> AuthModels.UserInfo { user }
    func refresh(refreshToken: String) async throws -> AuthModels.RefreshTokenResponse {
        .init(jwtToken: "offline-preview-access", refreshToken: "offline-preview-refresh", user: user)
    }
    func logout(refreshToken: String) async throws {}
}

@MainActor
private final class PreviewStorage: TokenStoring {
    var value: SessionCredentials?
    func read() throws -> SessionCredentials? { value }
    func save(_ credentials: SessionCredentials) throws { value = credentials }
    func clear() throws { value = nil }
}

@MainActor
private final class PreviewStudentsAPI: StudentsServing {
    let mode: String
    init(mode: String) { self.mode = mode }

    func list(accessToken: String) async throws -> [StudentModels.StudentResponse] {
        if mode == "students-unavailable" { throw AuthFailure.network }
        if mode == "students-empty" { return [] }
        return ["Alex Example", "Sam Example"].enumerated().map { index, name in
            StudentModels.StudentResponse(id: "preview-\(index)", name: name,
                billingEmailSource: "none", subjectIds: [], expectedAmount: 0,
                rateType: "hourly", frequencyPerWeek: 1, status: "active", amountOwed: 0,
                createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z")
        }
    }
}

@MainActor
private final class PreviewHomeAPI: HomeServing {
    let mode: String
    init(mode: String) { self.mode = mode }

    func summary(period: String, accessToken: String) async throws -> HomeModels.DashboardSummaryResponse {
        if mode == "home-unavailable" { throw AuthFailure.network }
        return HomeModels.DashboardSummaryResponse(
            period: period,
            rangeStart: "2026-01-05T00:00:00Z", rangeEnd: "2026-01-12T00:00:00Z",
            hoursWorked: 6, income: 360, studentCount: 2,
            hoursSeries: [], incomeSeries: [], previousHoursSeries: [], previousIncomeSeries: [],
            previousHoursWorked: 4, previousIncome: 240, lessonsTaught: 4, previousLessonsTaught: 3,
            attendanceRate: 1, unbilledLessons: 2, outstandingAmount: 120, overdueAmount: 0,
            today: .init(income: 0, hours: 1, lessonCount: 1),
            yesterday: .init(income: 120, hours: 1, lessonCount: 1)
        )
    }

    func lessons(accessToken: String) async throws -> [HomeModels.LessonResponse] {
        if mode == "home-unavailable" { throw AuthFailure.network }
        let now = Date()
        return [
            lesson(id: "preview-in-progress", studentIndex: 0, subject: "Mathematics",
                   start: now.addingTimeInterval(-20 * 60), durationMinutes: 60,
                   attendanceStatus: "unrecorded", meetLink: "https://meet.google.com/preview"),
            lesson(id: "preview-next", studentIndex: 1, subject: "Physics",
                   start: now.addingTimeInterval(3 * 3600), durationMinutes: 60,
                   attendanceStatus: "unrecorded"),
            lesson(id: "preview-todo", studentIndex: 0, subject: "Mathematics",
                   start: now.addingTimeInterval(-24 * 3600), durationMinutes: 60,
                   attendanceStatus: "unrecorded"),
            lesson(id: "preview-done", studentIndex: 1, subject: "Chemistry",
                   start: now.addingTimeInterval(-48 * 3600), durationMinutes: 90,
                   attendanceStatus: "present"),
        ]
    }

    func recordAttendance(id: String, status: String, accessToken: String) async throws -> HomeModels.LessonResponse {
        guard var updated = try await lessons(accessToken: accessToken).first(where: { $0.id == id }) else {
            throw AuthFailure.invalidResponse
        }
        updated.attendanceStatus = status
        return updated
    }

    private func lesson(id: String, studentIndex: Int, subject: String, start: Date,
                        durationMinutes: Int, attendanceStatus: String, meetLink: String? = nil) -> HomeModels.LessonResponse {
        HomeModels.LessonResponse(
            id: id, studentId: "preview-\(studentIndex)", subject: subject,
            startDateTime: PreviewHomeAPI.iso.string(from: start), durationMinutes: durationMinutes,
            meetLink: meetLink, acceptanceStatus: "accepted", attendanceStatus: attendanceStatus,
            remindersEnabled: true, isPaid: false,
            createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z"
        )
    }

    private static let iso = ISO8601DateFormatter()
}
#endif
