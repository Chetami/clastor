import SwiftUI

/// Minimal bar chart drawn with Canvas — current period in accent, previous
/// period as a faint bar behind. No dependencies, adapts to any series length.
struct MiniBarChart: View {
    let current: [Double]
    var previous: [Double]? = nil
    var tint: Color = .accentColor
    var height: CGFloat = 96

    var body: some View {
        Canvas { context, size in
            let values = current.isEmpty ? [0] : current
            let prev = previous ?? []
            let maxValue = Swift.max(values.max() ?? 1, prev.max() ?? 0, 1)
            let count = values.count
            let slot = size.width / CGFloat(count)
            let barWidth = Swift.min(slot * 0.62, 14)
            let chartHeight = size.height - 2

            for (index, value) in values.enumerated() {
                let x = CGFloat(index) * slot + (slot - barWidth) / 2
                if index < prev.count {
                    let prevHeight = max(2, CGFloat(prev[index]) / CGFloat(maxValue) * chartHeight)
                    context.fill(
                        Path(roundedRect: CGRect(x: x, y: size.height - prevHeight, width: barWidth, height: prevHeight),
                             cornerRadius: barWidth / 2),
                        with: .color(ClastorTheme.mutedInk.opacity(0.25)))
                }
                let barHeight = max(2, CGFloat(value) / CGFloat(maxValue) * chartHeight)
                context.fill(
                    Path(roundedRect: CGRect(x: x, y: size.height - barHeight, width: barWidth, height: barHeight),
                         cornerRadius: barWidth / 2),
                    with: .color(value > 0 ? tint : ClastorTheme.border))
            }
        }
        .frame(height: height)
        .accessibilityLabel("Bar chart")
    }
}
