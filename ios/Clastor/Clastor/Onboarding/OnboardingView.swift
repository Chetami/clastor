import SwiftUI

/// Onboarding tour — SCAFFOLD. Placeholder pages; real content and feature
/// deep-links land soon. Shown once after first launch (hasSeenOnboarding).
struct OnboardingView: View {
    @AppStorage("hasSeenOnboarding") private var hasSeenOnboarding = false
    @State private var page = 0
    @Environment(\.dismiss) private var dismiss

    private static let pages: [(icon: String, title: String, text: String)] = [
        ("house.fill", "Welcome to Clastor", "Manage your tutoring business — students, lessons and payments in one place."),
        ("calendar", "Stay on schedule", "See today's lessons at a glance and mark attendance as you go."),
        ("creditcard.fill", "Get paid on time", "Track invoices and what you're owed, from anywhere."),
    ]

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Spacer()
                Button("Skip") { finish() }
                    .font(.subheadline)
                    .foregroundStyle(ClastorTheme.mutedInk)
                    .padding()
            }
            TabView(selection: $page) {
                ForEach(Self.pages.indices, id: \.self) { index in
                    let page = Self.pages[index]
                    VStack(spacing: 18) {
                        Image(systemName: page.icon)
                            .font(.system(size: 56))
                            .foregroundStyle(Color.accentColor)
                            .padding(28)
                            .background(Color.accentColor.opacity(0.12), in: Circle())
                        Text(page.title)
                            .font(.title2.weight(.semibold))
                        Text(page.text)
                            .font(.body)
                            .foregroundStyle(ClastorTheme.mutedInk)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 36)
                    }
                    .tag(index)
                }
            }
            .tabViewStyle(.page)
            .indexViewStyle(.page(backgroundDisplayMode: .always))

            Button {
                if page == Self.pages.count - 1 { finish() } else { withAnimation { page += 1 } }
            } label: {
                Text(page == Self.pages.count - 1 ? "Get started" : "Continue")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .padding(.horizontal, 24)
            .padding(.bottom, 20)
        }
        .background(ClastorTheme.background.ignoresSafeArea())
    }

    private func finish() {
        hasSeenOnboarding = true
        dismiss()
    }
}
