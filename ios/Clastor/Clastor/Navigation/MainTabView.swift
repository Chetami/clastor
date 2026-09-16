import SwiftUI

struct MainTabView: View {
    let session: SessionStore

    var body: some View {
        TabView {
            Tab("Home", systemImage: "house") {
                NavigationStack {
                    HomeView(session: session)
                        .navigationDestination(for: LessonRoute.self) { route in
                            LessonDetailView(session: session, lessonID: route.id)
                        }
                }
            }
            Tab("Students", systemImage: "person.2") {
                NavigationStack {
                    StudentsView(session: session)
                        .navigationDestination(for: StudentRoute.self) { route in
                            StudentDetailView(session: session, studentID: route.id)
                        }
                }
            }
            Tab("Calendar", systemImage: "calendar") {
                NavigationStack {
                    CalendarView(session: session)
                        .navigationDestination(for: LessonRoute.self) { route in
                            LessonDetailView(session: session, lessonID: route.id)
                        }
                }
            }
            Tab("Payments", systemImage: "creditcard") {
                NavigationStack {
                    PaymentsView(session: session)
                        .navigationDestination(for: InvoiceRoute.self) { route in
                            InvoiceDetailView(session: session, invoiceID: route.id)
                        }
                }
            }
            Tab("Profile", systemImage: "person.crop.circle") {
                NavigationStack {
                    ProfileView(session: session)
                }
            }
        }
    }
}

