import SwiftUI

struct ContentView: View {
    let session: SessionStore

    var body: some View {
        if case .signedIn(let user) = session.phase {
            MainTabView(session: session)
                .id(user.uid)
        } else {
            NavigationStack {
                authenticationContent
                    .navigationTitle(session.appName)
                    .navigationBarTitleDisplayMode(.inline)
            }
        }
    }

    @ViewBuilder
    private var authenticationContent: some View {
        switch session.phase {
        case .signedOut, .signingIn:
            LoginView(session: session)
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
        case .signedIn:
            EmptyView()
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

#if DEBUG
#Preview {
    let session = AuthPreviewSupport.session()
    ContentView(session: session)
        .task { await session.restore() }
}
#endif
