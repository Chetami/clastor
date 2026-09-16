import Foundation

// MARK: Routes (value-based navigation within each tab's NavigationStack)

struct LessonRoute: Hashable {
    let id: String
}

struct StudentRoute: Hashable {
    let id: String
}

struct InvoiceRoute: Hashable {
    let id: String
}
