# Native iOS setup

Open `Clastor/Clastor.xcodeproj`. One app target has three shared schemes and
six build configurations. The schemes use Debug for Run/Test/Analyze and Release
for Profile/Archive, with the same environment throughout.

| Scheme | Configurations | Bundle ID | Firebase project | API |
| --- | --- | --- | --- | --- |
| Clastor Dev | Debug-Dev / Release-Dev | dev.chethin.Clastor.dev | xamify-tms | http://localhost:3001 |
| Clastor Staging | Debug-Staging / Release-Staging | dev.chethin.Clastor.staging | clastor-staging | https://clastor-backend.xamify.com.au |
| Clastor | Debug-Prod / Release-Prod | dev.chethin.Clastor | Must be supplied | Must be supplied |

Dev and staging defaults match the existing web environment configuration.
The apps have distinct display names, bundle IDs and token-storage namespaces.
Token storage is also scoped to the Firebase project and API origin, so changing
a local override cannot send saved credentials to another deployment.
The deployment target remains iOS 26.5. Product/module names stay `Clastor`.

## Supply your local Firebase configuration

Register each Apple bundle ID in the corresponding Firebase project. Download
that Apple app's `GoogleService-Info.plist` to the exact location below:

```text
ios/Clastor/Configuration/Firebase/dev/GoogleService-Info.plist
ios/Clastor/Configuration/Firebase/staging/GoogleService-Info.plist
ios/Clastor/Configuration/Firebase/prod/GoogleService-Info.plist
```

These files are ignored by Git. Keep them outside the synchronized
`Clastor/Clastor` source folder and do not add them to target membership or Copy
Bundle Resources. The build phase copies exactly one file into the app bundle.
It checks the environment, bundle ID, Firebase project ID and required Apple
configuration fields. Missing or mismatched configuration fails the build.

You can use Firebase Console or the CLI. Authenticate locally with
`firebase login`, then inspect existing registrations before creating another:

```sh
firebase apps:list IOS --project xamify-tms
firebase apps:list IOS --project clastor-staging
```

If the corresponding app does not exist:

```sh
firebase apps:create IOS 'Clastor Dev' --bundle-id dev.chethin.Clastor.dev --project xamify-tms
firebase apps:create IOS 'Clastor Staging' --bundle-id dev.chethin.Clastor.staging --project clastor-staging
```

Download its configuration using the app ID returned by Firebase:

```sh
firebase apps:sdkconfig IOS YOUR_DEV_IOS_APP_ID --project xamify-tms --out ios/Clastor/Configuration/Firebase/dev/GoogleService-Info.plist
firebase apps:sdkconfig IOS YOUR_STAGING_IOS_APP_ID --project clastor-staging --out ios/Clastor/Configuration/Firebase/staging/GoogleService-Info.plist
```

Firebase client plists contain public client identifiers. They are not Admin
credentials. Never include service-account private keys, server JWT signing
secrets, OAuth client secrets, passwords or user tokens in this app or repository.
Each backend must use its matching Firebase project and its own signing secrets.

## Local overrides and production

Public defaults live in `Configuration/Dev.xcconfig`,
`Staging.xcconfig` and `Prod.xcconfig`. To override one environment, copy its
`Firebase/<environment>/Local.xcconfig.example` to `Local.xcconfig` in the same
folder and edit it. The override is ignored by Git.

Production deliberately has no API or Firebase project default. Fill both values
and supply the production plist before building the production scheme.
There is no fallback from production to staging.

In xcconfig files, use `https:/$()/host`: the empty expansion preserves the URL
without introducing an xcconfig `//` comment. Configure the API origin only,
without `/api`, credentials, query parameters or fragments.

Simulator's `localhost` reaches your Mac. A physical device needs a reachable
HTTPS development API configured in dev's local override. Only the Dev
Info.plist permits HTTP for `localhost`; staging/production have no ATS exception.
Physical-device builds reject a localhost API with a message explaining which
scheme or override to use.

## Firebase initialization and verification

FirebaseCore and FirebaseAuth are pinned to 12.19.2 through Swift Package Manager;
commit `Package.resolved` when dependencies change. Firebase is configured once
through `AppDelegate`, after validating the built app's configuration.
App-delegate swizzling is disabled following Firebase's SwiftUI setup.
Previews do not initialize Firebase.

If the console shows a refused connection to `localhost:3001/api/auth/login`,
the app is running the local Dev configuration. On an iPhone, localhost is the
phone itself. Choose **Clastor Staging**, select the phone and run again to use
the hosted staging backend. On Simulator, start the backend on the Mac.
Use the account belonging to that Firebase environment.

Firebase's `App Delegate Proxy is disabled` entry confirms the intentional
SwiftUI setting; it is informational. Keyboard layout messages mentioning
`TUIPredictionViewCell` or `TUICandidateGradientContentLabel` originate in the
system keyboard. Diagnose a failed request using its URL and network error;
these keyboard messages do not explain a refused API connection.

The build phase uses declared input/output paths with Xcode script sandboxing
enabled, and does not print config contents.

## Basic email/password sign-in

Run **Clastor Staging** to use your existing staging account, or **Clastor Dev**
with the development backend running on your Mac. The app presents an email and
password form, then a simple account screen with a Sign out button. Accounts
belong to their Firebase environment; a staging account does not automatically
exist in dev. This increment signs into existing accounts. Registration,
password recovery, Google/Apple sign-in and account management are separate work.

The password goes only to Firebase's SDK. Its Firebase ID token is exchanged at
`POST /api/auth/login`; protected UI appears only after Clastor returns a user and
both Clastor tokens have been saved successfully. API models are generated from
the existing YAML contracts, including referenced user types:

```sh
npm run build:swift-auth --workspace=interfaces
npm run check:swift-auth --workspace=interfaces
npm run build:swift-students --workspace=interfaces
npm run check:swift-students --workspace=interfaces
```

The access/refresh pair is stored as one non-synchronizing Keychain item using
`WhenUnlockedThisDeviceOnly`. Passwords and credentials never go in UserDefaults
or logs. UserDefaults holds only a signed-out flag, so failed Keychain deletion
cannot silently restore a session on the next launch. Keychain items may survive
reinstall; any recovered session is verified with the backend before display.

Launch and foreground verification use `/api/auth/verify`. An expired access
token triggers one coordinated refresh; its replacement pair is saved before
showing the returned user. Verification outages show Retry and retain the pair.
Rate-limited refreshes can be retried. An interrupted or ambiguous refresh requires
sign-in again because replaying a consumed rotating token would revoke its family.
A Keychain marker also detects termination during rotation. No Firebase session
alone can recreate a Clastor session.

Sign out immediately clears local state, invalidates pending work and signs out
of Firebase. Server revocation is best-effort with a five-second request timeout;
the backend's already-issued access tokens retain their documented expiry.
The API transport rejects redirects and uses an ephemeral, uncached session.

After sign-in, the tab bar shows Home, Students, Calendar, Payments and Profile,
in that order. Home, Calendar, Payments and Profile are blank scaffolds with
page titles; Profile retains a Sign out button. Students calls `GET /api/students`
on the selected environment's backend using the Clastor access JWT, then shows
only names in a native list. Pull down to reload. Loading, empty and failed
requests have distinct states, with a retry button for failures. A 401 shares
the session's refresh flow and retries the request once. Student DTOs are
generated from the existing OpenAPI YAML, and student records are not persisted.

To check the live connection, run Clastor Dev or Clastor Staging in Simulator,
sign in to that environment, and open Students. Compare the names with the web
app signed in to the same account and environment. Normal runs use the real API;
only previews and the explicit Debug UI-test mode use offline examples.

`SessionStoreTests`, `AuthAPITests` and `KeychainTokenStoreTests` cover persistence,
token exchange, refresh races, network failures and logout. UI tests cover the
basic success/error screens with offline dependencies. Their `--auth-ui-test`
launch mode and preview fakes are compiled only in Debug and cannot contact real
services or use real Keychain credentials. Release builds omit those fakes.

```sh
python3 ios/Clastor/Scripts/test_prepare_firebase.py
xcodebuild -project ios/Clastor/Clastor.xcodeproj -scheme 'Clastor Dev' -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

Run `ClastorTests` on an installed iOS 26.5+ simulator for runtime configuration
and auth tests; keep normal Simulator ad-hoc code signing enabled for Keychain
tests. Run `ClastorUITests/ClastorUITests` for the offline sign-in screen tests.
Tests for the build phase use synthetic local plists and make no network
requests. For CI compilation without Firebase access, explicitly override
`FIREBASE_PLIST_PATH` with a synthetic Apple plist matching the selected
environment; never use such a build for distribution or provider integration tests.

After supplying real configuration, run Dev and Staging on Simulator and check
that both apps install separately. Signing on a physical device or distributing
an archive also requires the corresponding Apple App IDs/provisioning on your team.

References: [Firebase Apple setup](https://firebase.google.com/docs/ios/setup),
[multiple environments](https://firebase.google.com/docs/projects/multiprojects),
[SwiftUI integration](https://firebase.google.com/docs/ios/learn-more#swiftui).
