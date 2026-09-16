import SwiftUI
import WebKit

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

// MARK: Status badge

struct BadgeView: View {
    let label: String
    let tone: LessonDerivations.BadgeTone

    private var color: Color {
        switch tone {
        case .sky: return .blue
        case .amber: return .orange
        case .emerald: return .green
        case .rose: return .red
        case .muted: return .secondary
        }
    }

    var body: some View {
        Text(label)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(color.opacity(0.15), in: Capsule())
            .foregroundStyle(color)
    }
}

// MARK: Email HTML preview

/// Renders the preview endpoint's HTML email body (footer, RSVP buttons…) in
/// a no-JavaScript web view, like the web client's sandboxed iframe.
struct HTMLPreview: UIViewRepresentable {
    let html: String

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = false
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.isOpaque = false
        view.backgroundColor = UIColor.secondarySystemBackground
        return view
    }

    func updateUIView(_ view: WKWebView, context: Context) {
        guard context.coordinator.loadedHTML != html else { return }
        context.coordinator.loadedHTML = html
        view.loadHTMLString(html, baseURL: nil)
    }

    final class Coordinator {
        var loadedHTML: String?
    }
}
