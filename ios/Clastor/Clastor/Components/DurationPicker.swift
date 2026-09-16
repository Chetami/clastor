import SwiftUI

/// Duration picker matching the web's presets (30/45/60/90/120) plus an
/// "Other" mode with a 5-minute stepper.
struct DurationPicker: View {
    @Binding var minutes: Int
    @State private var usesCustom = false

    private static let presets = [30, 45, 60, 90, 120]

    var body: some View {
        Picker("Duration", selection: Binding(
            get: { usesCustom ? 0 : minutes },
            set: { newValue in
                if newValue == 0 {
                    usesCustom = true
                } else {
                    minutes = newValue
                    usesCustom = false
                }
            }
        )) {
            ForEach(Self.presets, id: \.self) { Text("\($0) min").tag($0) }
            Text("Other").tag(0)
        }
        if usesCustom {
            Stepper(value: $minutes, in: 5...600, step: 5) {
                Text("\(minutes) min")
            }
        }
    }
}
