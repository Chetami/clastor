import FirebaseCore
import UIKit

@MainActor
final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        #if DEBUG
        if AuthPreviewSupport.isUITesting { return true }
        #endif
        // Previews render views without starting SDKs or contacting any environment.
        guard ProcessInfo.processInfo.environment["XCODE_RUNNING_FOR_PREVIEWS"] != "1" else {
            return true
        }
        do {
            let configuration = try AppConfiguration.load()
            guard let path = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist"),
                  let options = FirebaseOptions(contentsOfFile: path),
                  options.projectID == configuration.firebaseProjectID,
                  options.bundleID == configuration.environment.bundleIdentifier else {
                preconditionFailure("Firebase configuration does not match the selected environment.")
            }
            FirebaseApp.configure()
        } catch {
            preconditionFailure("App configuration is invalid. Check the selected scheme and configuration.")
        }
        return true
    }
}
