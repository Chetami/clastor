import SwiftUI

/// Scaffold placeholder for features that are coming soon — dashed border
/// signals in-progress UI. Swap for the real implementation when it lands.
struct ComingSoonView: View {
    let icon: String
    let title: String
    var subtitle: String?

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundStyle(ClastorTheme.mutedInk)
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(ClastorTheme.ink)
            Text(subtitle ?? "Coming soon")
                .font(.caption)
                .foregroundStyle(ClastorTheme.mutedInk)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 18)
        .background(ClastorTheme.card.opacity(0.6), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .strokeBorder(ClastorTheme.border, style: StrokeStyle(lineWidth: 1, dash: [6, 5]))
        )
        .accessibilityIdentifier("comingSoon.\(title.replacingOccurrences(of: " ", with: "_"))")
    }
}
