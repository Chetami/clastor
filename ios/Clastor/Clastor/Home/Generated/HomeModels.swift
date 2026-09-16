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

    // src/schemas/lessons/res/LessonListResponse.yaml
    struct `LessonListResponse`: Codable, Equatable, Sendable {
        var `data`: [`LessonResponse`]
        var `nextCursor`: String? = nil
        var `hasMore`: Bool
    }

    // src/schemas/lessons/req/RecordAttendanceRequest.yaml
    struct `RecordAttendanceRequest`: Codable, Equatable, Sendable {
        var `attendanceStatus`: `AttendanceStatus`
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

    // src/schemas/lessons/res/LessonResponse.yaml
    struct `LessonResponse`: Codable, Equatable, Sendable {
        var `id`: String
        var `studentId`: String
        var `subject`: String? = nil
        var `startDateTime`: String
        var `durationMinutes`: Int
        var `location`: String? = nil
        var `meetLink`: String? = nil
        var `notes`: String? = nil
        var `todos`: [`LessonTodo`]? = nil
        var `acceptanceStatus`: `LessonAcceptance`
        var `attendanceStatus`: `AttendanceStatus`
        var `seriesId`: String? = nil
        var `isCancelled`: Bool? = nil
        var `isException`: Bool? = nil
        var `remindersEnabled`: Bool
        var `lastStudentNotifiedAt`: String? = nil
        var `studentNotifiedCount`: Int? = nil
        var `isPaid`: Bool
        var `invoiceId`: String? = nil
        var `googleCalendarEventId`: String? = nil
        var `googleCalendarSyncedAt`: String? = nil
        var `createdAt`: String
        var `updatedAt`: String
        var `tutorId`: String? = nil
        var `tutorName`: String? = nil
        var `tutorEmail`: String? = nil
    }

    // src/schemas/lessons/AttendanceStatus.yaml
    typealias `AttendanceStatus` = String

    // src/schemas/lessons/LessonTodo.yaml
    struct `LessonTodo`: Codable, Equatable, Sendable {
        var `id`: String
        var `text`: String
        var `done`: Bool
    }

    // src/schemas/lessons/LessonAcceptance.yaml
    typealias `LessonAcceptance` = String
}
