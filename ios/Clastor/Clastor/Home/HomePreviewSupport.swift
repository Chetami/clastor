#if DEBUG
import Foundation

// Home (dashboard summary) preview fake.
@MainActor
enum HomePreviewSupport {

@MainActor
static func api() -> any HomeServing { PreviewHomeAPI(mode: AuthPreviewSupport.activeScenario) }

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
}
}
#endif
