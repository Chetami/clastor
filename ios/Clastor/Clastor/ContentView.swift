import SwiftUI

struct ContentView: View {
    let session: SessionStore

    var body: some View {
        NavigationStack {
            Group {
                switch session.phase {
                case .signedOut, .signingIn:
                    LoginView(session: session)
                case .signedIn(let user):
                    SignedInView(user: user, signOut: session.signOut)
                case .restoring:
                    VStack(spacing: 24) {
                        ProgressView("Checking your session…")
                        Button("Sign out", action: session.signOut)
                    }
                case .retry:
                    ContentUnavailableView {
                        Label("Unable to connect", systemImage: "wifi.exclamationmark")
                    } description: {
                        Text(session.message ?? "Please try again.")
                    } actions: {
                        Button("Try again") { Task { await session.checkSession() } }
                            .buttonStyle(.borderedProminent)
                        Button("Sign out", action: session.signOut)
                    }
                }
            }
            .navigationTitle(session.appName)
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

private struct LoginView: View {
    let session: SessionStore
    @State private var email = ""
    @State private var password = ""
    @FocusState private var focus: Field?
    private enum Field { case email, password }
    private var isBusy: Bool { session.phase == .signingIn }

    var body: some View {
        Form {
            Section {
                TextField("Email", text: $email)
                    .keyboardType(.emailAddress)
                    .textContentType(.username)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .focused($focus, equals: .email)
                    .submitLabel(.next)
                    .onSubmit { focus = .password }
                    .accessibilityIdentifier("login.email")
                SecureField("Password", text: $password)
                    .textContentType(.password)
                    .focused($focus, equals: .password)
                    .submitLabel(.go)
                    .onSubmit(signIn)
                    .accessibilityIdentifier("login.password")
            } header: {
                Text("Sign in")
            } footer: {
                Text("Use your existing Clastor email and password.")
            }
            .disabled(isBusy)
            if let message = session.message {
                Section {
                    Text(message)
                        .foregroundStyle(.red)
                        .accessibilityIdentifier("login.error")
                }
            }
            Section {
                Button(action: signIn) {
                    HStack {
                        Spacer()
                        if isBusy { ProgressView().padding(.trailing, 6) }
                        Text(isBusy ? "Signing in…" : "Sign in")
                        Spacer()
                    }
                }
                .disabled(isBusy || email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || password.isEmpty)
                .accessibilityIdentifier("login.submit")
            }
        }
        .scrollDismissesKeyboard(.interactively)
    }

    private func signIn() {
        guard !isBusy, !email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, !password.isEmpty else { return }
        focus = nil
        let submittedPassword = password
        password = ""
        Task { await session.signIn(email: email, password: submittedPassword) }
    }
}

private struct SignedInView: View {
    let user: AuthModels.UserInfo
    let signOut: () -> Void

    var body: some View {
        Form {
            Section("Signed in") {
                if let name = user.name, !name.isEmpty {
                    LabeledContent("Name", value: name)
                }
                LabeledContent("Email", value: user.email)
                    .accessibilityIdentifier("account.email")
                LabeledContent("Role", value: user.role == "system_admin" ? "Administrator" : user.role.capitalized)
                if let verified = user.emailVerified {
                    LabeledContent("Email verified", value: verified ? "Yes" : "No")
                }
            }
            Section {
                Button("Sign out", role: .destructive, action: signOut)
                    .accessibilityIdentifier("account.signOut")
            }
        }
    }
}

#if DEBUG
#Preview {
    let session = AuthPreviewSupport.session()
    ContentView(session: session)
        .task { await session.restore() }
}
#endif
