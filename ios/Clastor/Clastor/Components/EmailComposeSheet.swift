import SwiftUI

/// Generic review-and-edit email sheet, the mobile counterpart of the web's
/// EmailComposeDialog: "To"/"Subject" are read-only, the message is editable,
/// and the rendered HTML preview refreshes (debounced) as the message changes.
/// The real action only fires on Send.
struct EmailComposeSheet: View {
    let title: String
    let sendLabel: String
    let fetchPreview: (_ message: String?) async throws -> LessonModels.EmailPreviewResponse
    let send: (_ message: String?) async throws -> Void
    let onSent: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var preview: LessonModels.EmailPreviewResponse?
    @State private var message = ""
    @State private var isLoading = true
    @State private var isSending = false
    @State private var failed = false
    @State private var failureMessage: String?

    private var canSend: Bool {
        preview?.to.isEmpty == false && !isLoading && !isSending
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    LabeledContent("To") {
                        Text(preview?.to.joined(separator: ", ") ?? "…")
                            .foregroundStyle(.secondary)
                    }
                    LabeledContent("Subject") {
                        Text(preview?.subject ?? "…")
                            .foregroundStyle(.secondary)
                    }
                }
                Section("Message") {
                    TextEditor(text: $message)
                        .frame(minHeight: 80)
                        .accessibilityIdentifier("email.message")
                }
                Section("Preview") {
                    if let preview {
                        HTMLPreview(html: preview.html)
                            .frame(minHeight: 280)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .listRowInsets(EdgeInsets(top: 8, leading: 12, bottom: 8, trailing: 12))
                    } else {
                        HStack {
                            Spacer()
                            ProgressView()
                            Spacer()
                        }
                        .frame(height: 280)
                    }
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(sendLabel) { Task { await sendEmail() } }
                        .disabled(!canSend)
                        .accessibilityIdentifier("email.send")
                }
            }
            .task {
                await load(message: nil)
            }
            .task(id: message) {
                // Debounced live refresh while editing; stale-response safe
                // because task(id:) cancels the previous fetch.
                try? await Task.sleep(for: .milliseconds(450))
                guard !Task.isCancelled else { return }
                await load(message: message, isFatal: false)
            }
            .alert("Could not send", isPresented: $failed) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(failureMessage ?? "Please try again.")
            }
        }

    }

    @MainActor
    private func load(message: String?, isFatal: Bool = true) async {
        if isFatal { isLoading = true }
        do {
            let fetched = try await fetchPreview(message)
            try Task.checkCancellation()
            preview = fetched
            if message == nil {
                self.message = fetched.defaultMessage
            }
            isLoading = false
        } catch is CancellationError {
        } catch AuthFailure.cancelled {
        } catch {
            if isFatal {
                isLoading = false
                failureMessage = AuthFailure.message(for: error)
                failed = true
            }
            // Edit-time refresh failures keep the last good preview.
        }
    }

    @MainActor
    private func sendEmail() async {
        guard !isSending else { return }
        isSending = true
        defer { isSending = false }
        do {
            try await send(message.isEmpty ? nil : message)
            onSent()
            dismiss()
        } catch is CancellationError {
        } catch AuthFailure.cancelled {
        } catch {
            failureMessage = AuthFailure.message(for: error)
            failed = true
        }
    }
}
