import SwiftUI

// MARK: - Theme
//
// Mirrors the web client's warm-sand palette (frontend/src/index.css): warm
// neutrals with the brand orange primary. Colors are dynamic so every
// branded view adapts to light/dark automatically.

enum ClastorTheme {
    /// Warm sand page background (light: sand-50, dark: warm black).
    static let background = Color(uiColor: UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(red: 0x30/255, green: 0x2A/255, blue: 0x27/255, alpha: 1)
            : UIColor(red: 0xFC/255, green: 0xF7/255, blue: 0xF1/255, alpha: 1)
    })

    /// Card / list-cell surface (light: white, dark: warm card).
    static let card = Color(uiColor: UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(red: 0x3B/255, green: 0x34/255, blue: 0x2F/255, alpha: 1)
            : .white
    })

    /// Primary ink (light: warm near-black, dark: warm off-white).
    static let ink = Color(uiColor: UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(red: 0xF7/255, green: 0xF4/255, blue: 0xF2/255, alpha: 1)
            : UIColor(red: 0x33/255, green: 0x2D/255, blue: 0x28/255, alpha: 1)
    })

    /// Muted foreground for secondary text.
    static let mutedInk = Color(uiColor: UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(red: 0xB9/255, green: 0xB1/255, blue: 0xAB/255, alpha: 1)
            : UIColor(red: 0x94/255, green: 0x8A/255, blue: 0x82/255, alpha: 1)
    })

    /// Hairline borders between warm surfaces.
    static let border = Color(uiColor: UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(red: 0x5F/255, green: 0x58/255, blue: 0x53/255, alpha: 1)
            : UIColor(red: 0xF0/255, green: 0xEA/255, blue: 0xE3/255, alpha: 1)
    })

    /// Sand fill for muted chips / tertiary surfaces.
    static let sand = Color(uiColor: UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(red: 0x4A/255, green: 0x43/255, blue: 0x3F/255, alpha: 1)
            : UIColor(red: 0xFB/255, green: 0xF4/255, blue: 0xEB/255, alpha: 1)
    })

    /// The brand display font ("Clastor" wordmark), per the web's Delius
    /// Swash Caps. Falls back to the system font if unavailable.
    static func display(_ size: CGFloat, relativeTo style: Font.TextStyle = .body) -> Font {
        .custom("Delius Swash Caps", size: size, relativeTo: style)
    }
}

// MARK: - Logo
//
// The hand-drawn "doodle" mark — a rounded card with notebook lines and the
// orange dot — drawn with theme tokens exactly like the web's LogoMark.tsx
// (frontend/src/components/ui/logo.tsx), so it adapts to appearance changes.

struct LogoMark: View {
    var size: CGFloat = 32

    var body: some View {
        Canvas { context, canvasSize in
            let s = canvasSize.width / 32
            let ink = ClastorTheme.ink
            let card = ClastorTheme.card
            let primary = Color.accentColor

            let rect = CGRect(x: 2.5 * s, y: 2.5 * s, width: 27 * s, height: 27 * s)
            let cardShape = Path(roundedRect: rect, cornerRadius: 8 * s)
            context.fill(cardShape, with: .color(card))
            context.stroke(cardShape, with: .color(ink), lineWidth: 2.5 * s)

            for (y, width) in [(11.0, 14.0), (16.0, 9.0), (21.0, 11.0)] {
                var line = Path()
                line.move(to: CGPoint(x: 9 * s, y: y * s))
                line.addLine(to: CGPoint(x: (9 + width) * s, y: y * s))
                context.stroke(line, with: .color(ink),
                               style: StrokeStyle(lineWidth: 2.2 * s, lineCap: .round))
            }

            let dot = CGRect(x: (22 - 3.2) * s, y: (21 - 3.2) * s,
                             width: 6.4 * s, height: 6.4 * s)
            context.fill(Path(ellipseIn: dot), with: .color(primary))
            context.stroke(Path(ellipseIn: dot), with: .color(ink), lineWidth: 2 * s)
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

/// Logo + "Clastor" wordmark, like the web's BrandMark.
struct BrandMark: View {
    var size: CGFloat = 40
    var showsName = true
    var subtitle: String?

    var body: some View {
        HStack(spacing: 10) {
            LogoMark(size: size)
            if showsName {
                if let subtitle {
                    VStack(alignment: .leading, spacing: 0) {
                        Text("Clastor")
                            .font(ClastorTheme.display(17, relativeTo: .body))
                            .foregroundStyle(ClastorTheme.ink)
                        Text(subtitle)
                            .font(.caption)
                            .foregroundStyle(ClastorTheme.mutedInk)
                    }
                } else {
                    Text("Clastor")
                        .font(ClastorTheme.display(24, relativeTo: .title3))
                        .foregroundStyle(ClastorTheme.ink)
                }
            }
        }
    }
}

// MARK: - Loading & splash screens

/// Full-screen branded splash — shown while the session is restored at cold
/// launch, mirroring the launch screen's background and mark.
struct SplashScreen: View {
    var text: String?

    var body: some View {
        VStack(spacing: 28) {
            LogoMark(size: 72)
            Text("Clastor")
                .font(ClastorTheme.display(40, relativeTo: .largeTitle))
                .foregroundStyle(ClastorTheme.ink)
            ProgressView()
                .tint(Color.accentColor)
                .controlSize(.large)
            if let text {
                Text(text)
                    .font(.subheadline)
                    .foregroundStyle(ClastorTheme.mutedInk)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(ClastorTheme.background.ignoresSafeArea())
    }
}

/// Inline branded loading state for list screens — the logo mark over a
/// tinted spinner, replacing the bare system ProgressView.
struct ClastorLoading: View {
    var text: String?

    var body: some View {
        VStack(spacing: 14) {
            LogoMark(size: 40)
            ProgressView()
                .tint(Color.accentColor)
            if let text {
                Text(text)
                    .font(.footnote)
                    .foregroundStyle(ClastorTheme.mutedInk)
            }
        }
        .padding(24)
        .accessibilityIdentifier("clastor.loading")
    }
}

// MARK: - Screen modifier

extension View {
    /// Applies the Clastor screen treatment: warm sand background, warm card
    /// list rows, over the system chrome. Use on List/Form screens.
    func clastorScreen() -> some View {
        listRowBackground(ClastorTheme.card)
            .scrollContentBackground(.hidden)
            .background(ClastorTheme.background.ignoresSafeArea())
    }

    /// Card container for content composed outside a List (login, stat tiles).
    func clastorCard(padding: CGFloat = 16) -> some View {
        self
            .padding(padding)
            .background(ClastorTheme.card, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .strokeBorder(ClastorTheme.border, lineWidth: 1)
            )
    }
}
