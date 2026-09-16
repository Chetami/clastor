// Generated from interfaces/src/openapi.yaml. Do not edit.
// Regenerate: npm run build:swift-home --workspace=interfaces

nonisolated enum HomeModels {
    // src/schemas/dashboard/res/DashboardSummaryResponse.yaml
    struct `DashboardSummaryResponse`: Codable, Equatable, Sendable {
        var `period`: `DashboardPeriod`
        var `rangeStart`: String
        var `rangeEnd`: String
        var `hoursWorked`: Double
        var `income`: Double
        var `studentCount`: Int
        var `hoursSeries`: [`DashboardSeriesPoint`]
        var `incomeSeries`: [`DashboardSeriesPoint`]
        var `previousHoursSeries`: [`DashboardSeriesPoint`]
        var `previousIncomeSeries`: [`DashboardSeriesPoint`]
        var `previousHoursWorked`: Double
        var `previousIncome`: Double
        var `lessonsTaught`: Int
        var `previousLessonsTaught`: Int
        var `attendanceRate`: Double? = nil
        var `unbilledLessons`: Int
        var `outstandingAmount`: Double
        var `overdueAmount`: Double
        var `today`: `DashboardDayBreakdown`
        var `yesterday`: `DashboardDayBreakdown`
    }

    // src/schemas/dashboard/DashboardPeriod.yaml
    typealias `DashboardPeriod` = String

    // src/schemas/dashboard/res/DashboardSeriesPoint.yaml
    struct `DashboardSeriesPoint`: Codable, Equatable, Sendable {
        var `label`: String
        var `date`: String
        var `value`: Double
    }

    // src/schemas/dashboard/res/DashboardDayBreakdown.yaml
    struct `DashboardDayBreakdown`: Codable, Equatable, Sendable {
        var `income`: Double
        var `hours`: Double
        var `lessonCount`: Int
    }
}
