// Generated from interfaces/src/openapi.yaml. Do not edit.
// Regenerate: npm run build:swift-auth --workspace=interfaces

nonisolated enum AuthModels {
    // src/schemas/auth/res/LoginResponse.yaml
    struct `LoginResponse`: Codable, Equatable, Sendable {
        var `jwtToken`: String
        var `refreshToken`: String
        var `user`: `UserInfo`
        var `isNewUser`: Bool? = nil
    }

    // src/schemas/auth/res/RefreshTokenResponse.yaml
    struct `RefreshTokenResponse`: Codable, Equatable, Sendable {
        var `jwtToken`: String
        var `refreshToken`: String
        var `user`: `UserInfo`
    }

    // src/schemas/auth/res/VerifyTokenResponse.yaml
    struct `VerifyTokenResponse`: Codable, Equatable, Sendable {
        var `user`: `UserInfo`
    }

    // src/schemas/auth/req/RefreshTokenRequest.yaml
    struct `RefreshTokenRequest`: Codable, Equatable, Sendable {
        var `refreshToken`: String
    }

    // src/schemas/common/ApiError.yaml
    struct `ApiError`: Codable, Equatable, Sendable {
        var `message`: String
        var `code`: String? = nil
    }

    // src/schemas/auth/res/UserInfo.yaml
    struct `UserInfo`: Codable, Equatable, Sendable {
        var `uid`: String
        var `name`: String? = nil
        var `email`: String
        var `role`: `Role`
        var `emailVerified`: Bool? = nil
        var `avatarUrl`: String? = nil
        var `currency`: String? = nil
        var `timezone`: String? = nil
        var `reminderLeadTime`: `ReminderLeadTime`? = nil
        var `workingHours`: `WorkingHours`? = nil
        var `subjects`: [`Subject`]? = nil
        var `onboardingComplete`: Bool
        var `googleConnected`: Bool? = nil
        var `tourSeen`: Bool
        var `invoiceSettings`: `InvoiceSettings`? = nil
        var `emailReviewSettings`: `EmailReviewSettings`? = nil
        var `signupSurvey`: `SignupSurvey`? = nil
    }

    // src/schemas/common/Role.yaml
    typealias `Role` = String

    // src/schemas/common/ReminderLeadTime.yaml
    typealias `ReminderLeadTime` = String

    // src/schemas/users/WorkingHours.yaml
    struct `WorkingHours`: Codable, Equatable, Sendable {
        var `monday`: `WorkingDayWindow`? = nil
        var `tuesday`: `WorkingDayWindow`? = nil
        var `wednesday`: `WorkingDayWindow`? = nil
        var `thursday`: `WorkingDayWindow`? = nil
        var `friday`: `WorkingDayWindow`? = nil
        var `saturday`: `WorkingDayWindow`? = nil
        var `sunday`: `WorkingDayWindow`? = nil
    }

    // src/schemas/common/Subject.yaml
    struct `Subject`: Codable, Equatable, Sendable {
        var `id`: String
        var `name`: String
        var `color`: String? = nil
    }

    // src/schemas/users/InvoiceSettings.yaml
    struct `InvoiceSettings`: Codable, Equatable, Sendable {
        var `abn`: String? = nil
        var `bankDetails`: `BankDetails`? = nil
    }

    // src/schemas/users/EmailReviewSettings.yaml
    struct `EmailReviewSettings`: Codable, Equatable, Sendable {
        var `reviewEnabled`: Bool? = nil
    }

    // src/schemas/users/SignupSurvey.yaml
    struct `SignupSurvey`: Codable, Equatable, Sendable {
        var `intent`: String? = nil
        var `studentCountBucket`: String? = nil
        var `tutoringFormat`: String? = nil
        var `tutorCountBucket`: String? = nil
        var `currentTools`: [String]? = nil
    }

    // src/schemas/users/WorkingDayWindow.yaml
    struct `WorkingDayWindow`: Codable, Equatable, Sendable {
        var `start`: String
        var `end`: String
    }

    // src/schemas/users/BankDetails.yaml
    struct `BankDetails`: Codable, Equatable, Sendable {
        var `accountName`: String? = nil
        var `bsb`: String? = nil
        var `accountNumber`: String? = nil
    }
}
