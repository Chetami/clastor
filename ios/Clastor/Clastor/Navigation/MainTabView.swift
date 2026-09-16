import SwiftUI

struct MainTabView: View {
    let session: SessionStore

    var body: some View {
        TabView {
            Tab("Home", systemImage: "house") {
                NavigationStack { HomeView(session: session) }
            }
            Tab("Students", systemImage: "person.2") {
                NavigationStack { StudentsView(session: session) }
            }
            Tab("Calendar", systemImage: "calendar") {
                NavigationStack { BlankPage(title: "Calendar") }
            }
            Tab("Payments", systemImage: "creditcard") {
                NavigationStack { BlankPage(title: "Payments") }
            }
            Tab("Profile", systemImage: "person.crop.circle") {
                NavigationStack {
                    BlankPage(title: "Profile")
                        .toolbar {
                            ToolbarItem(placement: .topBarTrailing) {
                                Button("Sign out", action: session.signOut)
                                    .accessibilityIdentifier("account.signOut")
                            }
                        }
                }
            }
        }
    }
}

private struct BlankPage: View {
    let title: String

    var body: some View {
        Color(.systemBackground)
            .navigationTitle(title)
    }
}
