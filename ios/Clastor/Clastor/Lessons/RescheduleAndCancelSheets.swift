import SwiftUI

/// Reschedule sheet — mirrors the web's RescheduleDialog. When "notify
/// student" is on, the reschedule only fires from the email review sheet's
/// Send button; with notify off it runs immediately.
struct RescheduleSheet: View {
    let session: SessionStore
    let lesson: LessonModels.LessonResponse
    let onDone: (LessonModels.LessonResponse) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var api: any LessonServing = LessonAPI.live()
    @State private var start: Date
    @State private var durationMinutes: Int
    @State private var scope = "this"
    @State private var notify = true
    @State private var showEmailReview = false
    @State private var isWorking = false
    @State private var failed = false
    @State private var failureMessage: String?

    private let isSeries: Bool

    init(session: SessionStore, lesson: LessonModels.LessonResponse, onDone: @escaping (LessonModels.LessonResponse) -> Void) {
        self.session = session
        self.lesson = lesson
        self.onDone = onDone
        _start = State(initialValue: HomeDerivations.date(lesson.startDateTime) ?? Date())
        _durationMinutes = State(initialValue: lesson.durationMinutes)
        isSeries = lesson.seriesId != nil
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    DatePicker("Starts", selection: $start)
                    DurationPicker(minutes: $durationMinutes)
                } header: {
                    Text("New time")
                } footer: {
                    if let start = HomeDerivations.date(lesson.startDateTime) {
                        Text("Currently \(LessonDerivations.formatLessonDateTime(start))")
                    }
                }
                if isSeries {
                    Section("Apply to") {
                        Picker("Scope", selection: $scope) {
                            Text("Just this lesson").tag("this")
                            Text("This & future").tag("this_and_future")
                        }
                        .pickerStyle(.inline)
                        .labelsHidden()
                    }
                }
                Section {
                    Toggle("Notify student about the new time", isOn: $notify)
                } footer: {
                    Text("You'll review the email before it's sent.")
                }
            }
            .navigationTitle("Reschedule")
            .clastorScreen()
.navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(notify ? "Review email" : "Reschedule") {
                        Task { await submit() }
                    }
                    .disabled(isWorking)
                }
            }
            .sheet(isPresented: $showEmailReview) {
                EmailComposeSheet(
                    title: "Review reschedule email",
                    sendLabel: "Send email",
                    fetchPreview: { message in
                        try await self.session.authenticated { token in
                            try await api.reschedulePreview(id: lesson.id, request(message: message), accessToken: token)
                        }
                    },
                    send: { message in
                        let updated = try await self.session.authenticated { token in
                            try await api.reschedule(id: lesson.id, request(message: message), accessToken: token)
                        }
                        pendingUpdated = updated
                    },
                    onSent: {
                        if let pendingUpdated {
                            onDone(pendingUpdated)
                        }
                        dismiss()
                    }
                )
            }
            .alert("Could not reschedule", isPresented: $failed) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(failureMessage ?? "Please try again.")
            }
        }
    }

    @State private var pendingUpdated: LessonModels.LessonResponse?

    private func request(message: String?) -> LessonModels.RescheduleLessonRequest {
        let iso = ISO8601DateFormatter()
        return LessonModels.RescheduleLessonRequest(
            startDateTime: iso.string(from: start),
            durationMinutes: durationMinutes,
            notifyStudent: notify,
            message: message,
            scope: isSeries ? scope : nil
        )
    }

    @MainActor
    private func submit() async {
        guard !isWorking else { return }
        isWorking = true
        defer { isWorking = false }
        if notify {
            showEmailReview = true
            return
        }
        do {
            let updated = try await session.authenticated { token in
                try await api.reschedule(id: lesson.id, request(message: nil), accessToken: token)
            }
            onDone(updated)
            dismiss()
        } catch is CancellationError {
        } catch AuthFailure.cancelled {
        } catch {
            failureMessage = AuthFailure.message(for: error)
            failed = true
        }
    }
}

/// Cancel sheet — mirrors the web's CancelLessonDialog, with the same
/// preview-then-send flow when notifying the student.
struct CancelLessonSheet: View {
    let session: SessionStore
    let lesson: LessonModels.LessonResponse
    let onDone: (LessonModels.LessonResponse) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var api: any LessonServing = LessonAPI.live()
    @State private var scope = "this"
    @State private var notify = true
    @State private var showEmailReview = false
    @State private var isWorking = false
    @State private var failed = false
    @State private var failureMessage: String?
    @State private var pendingUpdated: LessonModels.LessonResponse?

    private let isSeries: Bool

    init(session: SessionStore, lesson: LessonModels.LessonResponse, onDone: @escaping (LessonModels.LessonResponse) -> Void) {
        self.session = session
        self.lesson = lesson
        self.onDone = onDone
        isSeries = lesson.seriesId != nil
    }

    var body: some View {
        NavigationStack {
            Form {
                if isSeries {
                    Section("Apply to") {
                        Picker("Scope", selection: $scope) {
                            Text("Just this lesson").tag("this")
                            Text("This & future").tag("this_and_future")
                        }
                        .pickerStyle(.inline)
                        .labelsHidden()
                    }
                }
                Section {
                    Toggle("Notify student about the cancellation", isOn: $notify)
                } footer: {
                    Text(notify
                         ? "Sends a cancellation email. You'll review it before it's sent."
                         : "The lesson is cancelled without an email.")
                }
            }
            .navigationTitle("Cancel lesson")
            .clastorScreen()
.navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Keep lesson") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(notify ? "Review email" : "Cancel lesson", role: .destructive) {
                        Task { await submit() }
                    }
                    .disabled(isWorking)
                }
            }
            .sheet(isPresented: $showEmailReview) {
                EmailComposeSheet(
                    title: "Review cancellation email",
                    sendLabel: "Send email",
                    fetchPreview: { message in
                        try await self.session.authenticated { token in
                            try await api.cancelPreview(id: lesson.id, request(message: message), accessToken: token)
                        }
                    },
                    send: { message in
                        let updated = try await self.session.authenticated { token in
                            try await api.cancel(id: lesson.id, request(message: message), accessToken: token)
                        }
                        pendingUpdated = updated
                    },
                    onSent: {
                        if let pendingUpdated {
                            onDone(pendingUpdated)
                        }
                        dismiss()
                    }
                )
            }
            .alert("Could not cancel", isPresented: $failed) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(failureMessage ?? "Please try again.")
            }
        }
    }

    private func request(message: String?) -> LessonModels.CancelLessonRequest {
        LessonModels.CancelLessonRequest(
            notifyStudent: notify,
            message: message,
            scope: isSeries ? scope : nil
        )
    }

    @MainActor
    private func submit() async {
        guard !isWorking else { return }
        isWorking = true
        defer { isWorking = false }
        if notify {
            showEmailReview = true
            return
        }
        do {
            let updated = try await session.authenticated { token in
                try await api.cancel(id: lesson.id, request(message: nil), accessToken: token)
            }
            onDone(updated)
            dismiss()
        } catch is CancellationError {
        } catch AuthFailure.cancelled {
        } catch {
            failureMessage = AuthFailure.message(for: error)
            failed = true
        }
    }
}
