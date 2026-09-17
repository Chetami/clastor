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
            SplashScreen(text: "Checking your session…")
                .safeAreaInset(edge: .bottom) {
                    Button("Sign out", action: session.signOut)
                        .font(.footnote)
                        .foregroundStyle(ClastorTheme.mutedInk)
                        .padding(.bottom, 24)
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
        ScrollView {
            VStack(spacing: 24) {
                BrandMark(size: 56, subtitle: "Tutor management")
                    .padding(.top, 48)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Welcome back")
                        .font(ClastorTheme.display(28, relativeTo: .title2))
                        .foregroundStyle(ClastorTheme.ink)
                    Text("Sign in to your tutor account.")
                        .font(.subheadline)
                        .foregroundStyle(ClastorTheme.mutedInk)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 4)

                VStack(alignment: .leading, spacing: 14) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Email")
                            .font(.caption.weight(.medium))
                            .foregroundStyle(ClastorTheme.mutedInk)
                        TextField("Email", text: $email)
                            .keyboardType(.emailAddress)
                            .textContentType(.username)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .focused($focus, equals: .email)
                            .submitLabel(.next)
                            .onSubmit { focus = .password }
                            .padding(12)
                            .background(ClastorTheme.sand, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                            .accessibilityIdentifier("login.email")
                    }
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Password")
                            .font(.caption.weight(.medium))
                            .foregroundStyle(ClastorTheme.mutedInk)
                        SecureField("Password", text: $password)
                            .textContentType(.password)
                            .focused($focus, equals: .password)
                            .submitLabel(.go)
                            .onSubmit(signIn)
                            .padding(12)
                            .background(ClastorTheme.sand, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                            .accessibilityIdentifier("login.password")
                    }
                }
                .padding(16)
                .background(ClastorTheme.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .strokeBorder(ClastorTheme.border, lineWidth: 1)
                )
                .disabled(isBusy)

                if let message = session.message {
                    Text(message)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)
                        .accessibilityIdentifier("login.error")
                }

                Button(action: signIn) {
                    HStack {
                        Spacer()
                        if isBusy { ProgressView().padding(.trailing, 6) }
                        Text(isBusy ? "Signing in…" : "Sign in")
                        Spacer()
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(isBusy || email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || password.isEmpty)
                .accessibilityIdentifier("login.submit")

                Spacer(minLength: 24)
            }
            .padding(.horizontal, 24)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(ClastorTheme.background.ignoresSafeArea())
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
