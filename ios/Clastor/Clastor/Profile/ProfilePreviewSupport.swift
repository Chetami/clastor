#if DEBUG
import Foundation

// Profile (user settings) preview fake — mutates the shared PreviewStore's
// user so currency/subject changes surface across every tab in previews and
// UI tests, mirroring the real backend's read-time effects.
@MainActor
enum ProfilePreviewSupport {
    static func api() -> any UserServing { PreviewUserAPI() }
}

@MainActor
private final class PreviewUserAPI: UserServing {
    func updateMe(_ request: AuthModels.UpdateUserRequest, accessToken: String) async throws -> AuthModels.UserInfo {
        var updated = PreviewStore.shared.user
        if let name = request.name { updated.name = name }
        if let currency = request.currency { updated.currency = currency }
        if request.timezone != nil { updated.timezone = request.timezone }
        if let subjects = request.subjects { updated.subjects = subjects }
        PreviewStore.shared.apply(updated)
        return updated
    }
}
#endif
