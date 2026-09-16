// Generated from interfaces/src/openapi.yaml. Do not edit.
// Regenerate: npm run build:swift-lessons --workspace=interfaces

nonisolated enum LessonModels {
    // src/schemas/lessons/res/LessonListResponse.yaml
    struct `LessonListResponse`: Codable, Equatable, Sendable {
        var `data`: [`LessonResponse`]
        var `nextCursor`: String? = nil
        var `hasMore`: Bool
    }

    // src/schemas/lessons/res/LessonSeriesResponse.yaml
    struct `LessonSeriesResponse`: Codable, Equatable, Sendable {
        var `id`: String
        var `studentId`: String
        var `subject`: String
        var `durationMinutes`: Int
        var `location`: String? = nil
        var `meetLink`: String? = nil
        var `notes`: String? = nil
        var `intervalWeeks`: Int
        var `slots`: [`LessonSlot`]
        var `timezone`: String
        var `startDate`: String
        var `until`: String? = nil
        var `count`: Int? = nil
        var `acceptanceStatus`: `LessonAcceptance`
        var `remindersEnabled`: Bool
        var `createdAt`: String
        var `updatedAt`: String
    }

    // src/schemas/lessons/res/CreateRecurringLessonResponse.yaml
    struct `CreateRecurringLessonResponse`: Codable, Equatable, Sendable {
        var `seriesId`: String
        var `count`: Int
    }

    // src/schemas/lessons/req/CreateLessonRequest.yaml
    struct `CreateLessonRequest`: Codable, Equatable, Sendable {
        var `studentId`: String
        var `subject`: String? = nil
        var `startDateTime`: String
        var `durationMinutes`: Int
        var `location`: String? = nil
        var `notes`: String? = nil
        var `remindersEnabled`: Bool? = nil
    }

    // src/schemas/lessons/req/CreateRecurringLessonRequest.yaml
    struct `CreateRecurringLessonRequest`: Codable, Equatable, Sendable {
        var `studentId`: String
        var `subject`: String? = nil
        var `durationMinutes`: Int
        var `location`: String? = nil
        var `notes`: String? = nil
        var `intervalWeeks`: Int
        var `slots`: [`LessonSlot`]
        var `timezone`: String
        var `startDate`: String
        var `until`: String? = nil
        var `count`: Int? = nil
        var `remindersEnabled`: Bool? = nil
    }

    // src/schemas/lessons/req/UpdateLessonRequest.yaml
    struct `UpdateLessonRequest`: Codable, Equatable, Sendable {
        var `studentId`: String? = nil
        var `subject`: String? = nil
        var `startDateTime`: String? = nil
        var `durationMinutes`: Int? = nil
        var `location`: String? = nil
        var `meetLink`: String? = nil
        var `notes`: String? = nil
        var `todos`: [`LessonTodo`]? = nil
        var `acceptanceStatus`: `LessonAcceptance`? = nil
        var `remindersEnabled`: Bool? = nil
        var `isPaid`: Bool? = nil
    }

    // src/schemas/lessons/req/RescheduleLessonRequest.yaml
    struct `RescheduleLessonRequest`: Codable, Equatable, Sendable {
        var `startDateTime`: String
        var `durationMinutes`: Int? = nil
        var `notifyStudent`: Bool? = nil
        var `message`: String? = nil
        var `scope`: String? = nil
    }

    // src/schemas/lessons/req/CancelLessonRequest.yaml
    struct `CancelLessonRequest`: Codable, Equatable, Sendable {
        var `notifyStudent`: Bool? = nil
        var `message`: String? = nil
        var `scope`: String? = nil
    }

    // src/schemas/lessons/req/NotifyStudentRequest.yaml
    struct `NotifyStudentRequest`: Codable, Equatable, Sendable {
        var `message`: String? = nil
    }

    // src/schemas/lessons/req/RecordAttendanceRequest.yaml
    struct `RecordAttendanceRequest`: Codable, Equatable, Sendable {
        var `attendanceStatus`: `AttendanceStatus`
    }

    // src/schemas/meetings/req/GenerateMeetLinkRequest.yaml
    struct `GenerateMeetLinkRequest`: Codable, Equatable, Sendable {
        var `lessonId`: String? = nil
        var `startDateTime`: String? = nil
        var `durationMinutes`: Int? = nil
    }

    // src/schemas/meetings/res/GenerateMeetLinkResponse.yaml
    struct `GenerateMeetLinkResponse`: Codable, Equatable, Sendable {
        var `meetingLink`: String
        var `calendarEventId`: String
    }

    // src/schemas/lessons/res/GenerateSeriesMeetLinkResponse.yaml
    struct `GenerateSeriesMeetLinkResponse`: Codable, Equatable, Sendable {
        var `meetingLink`: String
        var `appliedTo`: Int
        var `calendarFailed`: Int? = nil
    }

    // src/schemas/emails/res/EmailPreviewResponse.yaml
    struct `EmailPreviewResponse`: Codable, Equatable, Sendable {
        var `to`: [String]
        var `subject`: String
        var `text`: String
        var `html`: String
        var `defaultSubject`: String
        var `defaultMessage`: String
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

    // src/schemas/lessons/LessonSlot.yaml
    struct `LessonSlot`: Codable, Equatable, Sendable {
        var `dayOfWeek`: `DayOfWeek`
        var `timeOfDay`: String
    }

    // src/schemas/lessons/LessonAcceptance.yaml
    typealias `LessonAcceptance` = String

    // src/schemas/lessons/LessonTodo.yaml
    struct `LessonTodo`: Codable, Equatable, Sendable {
        var `id`: String
        var `text`: String
        var `done`: Bool
    }

    // src/schemas/lessons/AttendanceStatus.yaml
    typealias `AttendanceStatus` = String

    // src/schemas/lessons/DayOfWeek.yaml
    typealias `DayOfWeek` = String
}
