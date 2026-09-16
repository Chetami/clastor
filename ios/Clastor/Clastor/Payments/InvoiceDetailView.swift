import SwiftUI

/// Invoice detail — summary, line items, activity timeline and the actions:
/// send/resend (with email review + resend cooldown), mark paid, void.
struct InvoiceDetailView: View {
    let session: SessionStore
    let invoiceID: String

    @State private var api: any InvoiceServing = InvoiceAPI.live()
    @State private var invoice: PaymentModels.InvoiceResponse?
    @State private var events: [PaymentModels.InvoiceEventResponse] = []
    @State private var isLoading = false
    @State private var hasLoaded = false
    @State private var message: String?
    @State private var showSend = false
    @State private var showMarkPaid = false
    @State private var showVoid = false
    @State private var isWorking = false
    @State private var actionFailed = false
    @State private var actionFailureMessage: String?

    var body: some View {
        List {
            if let invoice {
                headerSection(invoice)
                detailsSection(invoice)
                lineItemsSection(invoice)
                if let notes = invoice.notes, !notes.isEmpty {
                    Section("Notes") {
                        Text(notes)
                    }
                }
                actionsSection(invoice)
                timelineSection
            }
        }
        .navigationTitle(invoice?.invoiceNumber ?? "Invoice")
        .navigationBarTitleDisplayMode(.inline)
        .overlay {
            if isLoading && invoice == nil {
                ProgressView("Loading…")
            } else if let message, invoice == nil {
                ContentUnavailableView {
                    Label("Could not load invoice", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(message)
                } actions: {
                    Button("Try again") { Task { await load() } }
                        .buttonStyle(.borderedProminent)
                }
            } else if hasLoaded, invoice == nil {
                ContentUnavailableView("Invoice not found", systemImage: "doc.text.magnifyingglass")
            }
        }
        .task {
            if invoice == nil { await load() }
        }
        .refreshable { await load(isFatal: false) }
        .sheet(isPresented: $showSend) {
            if let invoice {
                EmailComposeSheet(
                    title: invoice.sentAt == nil ? "Send invoice" : "Resend invoice",
                    sendLabel: "Send email",
                    fetchPreview: { message in
                        try await self.session.authenticated { token in
                            try await api.sendPreview(id: invoice.id, message: message, accessToken: token)
                        }
                    },
                    send: { message in
                        let updated = try await self.session.authenticated { token in
                            try await api.send(id: invoice.id, message: message, accessToken: token)
                        }
                        self.invoice = updated
                    },
                    onSent: {}
                )
            }
        }
        .confirmationDialog("Mark this invoice as paid?", isPresented: $showMarkPaid, titleVisibility: .visible) {
            Button("Mark as paid") { Task { await markPaid() } }
            Button("Cancel", role: .cancel) {}
        }
        .confirmationDialog("Void this invoice? This cannot be undone.", isPresented: $showVoid, titleVisibility: .visible) {
            Button("Void invoice", role: .destructive) { Task { await voidInvoice() } }
            Button("Cancel", role: .cancel) {}
        }
        .alert("Could not save", isPresented: $actionFailed) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(actionFailureMessage ?? "Please try again.")
        }
    }

    // MARK: Sections

    private func headerSection(_ invoice: PaymentModels.InvoiceResponse) -> some View {
        Section {
            HStack {
                Text(InvoiceDerivations.formatCurrency(invoice.total, currency: invoice.currency))
                    .font(.title2.weight(.semibold))
                Spacer()
                statusBadge(invoice)
            }
            LabeledContent("Customer") {
                Text(invoice.customerName)
            }
            if let email = invoice.billingEmail {
                LabeledContent("Email") {
                    Text(email).textSelection(.enabled)
                }
            }
        }
        .accessibilityIdentifier("invoice.header")
    }

    private func detailsSection(_ invoice: PaymentModels.InvoiceResponse) -> some View {
        Section("Details") {
            LabeledContent("Issued") {
                Text(InvoiceDerivations.formatDate(invoice.issueDate))
            }
            LabeledContent("Due") {
                Text(InvoiceDerivations.formatDate(invoice.dueDate))
            }
            if let sentAt = invoice.sentAt {
                LabeledContent("Sent") {
                    Text(InvoiceDerivations.formatDate(sentAt))
                }
            } else {
                LabeledContent("Sent") {
                    Text("Not sent yet").foregroundStyle(.secondary)
                }
            }
            if let paidAt = invoice.paidAt {
                LabeledContent("Paid") {
                    Text(InvoiceDerivations.formatDate(paidAt))
                }
            }
            LabeledContent("Payment method") {
                Text(InvoiceDerivations.paymentMethodLabel(invoice.paymentMethod))
            }
        }
    }

    private func lineItemsSection(_ invoice: PaymentModels.InvoiceResponse) -> some View {
        Section("Line items") {
            ForEach(invoice.lineItems, id: \.lessonId) { item in
                VStack(alignment: .leading, spacing: 3) {
                    Text(item.description)
                        .font(.subheadline)
                    HStack {
                        Text(item.rateType == "hourly"
                             ? "\(formatNumber(item.quantity)) hrs × \(InvoiceDerivations.formatCurrency(item.unitAmount, currency: invoice.currency))"
                             : "1 × \(InvoiceDerivations.formatCurrency(item.unitAmount, currency: invoice.currency))")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Spacer()
                        Text(InvoiceDerivations.formatCurrency(item.amount, currency: invoice.currency))
                            .font(.subheadline.weight(.medium))
                    }
                }
                .padding(.vertical, 2)
            }
            LabeledContent("Subtotal") {
                Text(InvoiceDerivations.formatCurrency(invoice.subtotal, currency: invoice.currency))
            }
            LabeledContent("Total") {
                Text(InvoiceDerivations.formatCurrency(invoice.total, currency: invoice.currency))
                    .font(.body.weight(.semibold))
            }
        }
    }

    private func actionsSection(_ invoice: PaymentModels.InvoiceResponse) -> some View {
        Section("Actions") {
            if invoice.status != "paid" && invoice.status != "void" {
                sendButton(invoice)
                if invoice.status == "open" || invoice.status == "overdue" {
                    Button("Mark as paid") { showMarkPaid = true }
                        .disabled(isWorking)
                        .accessibilityIdentifier("invoice.markPaid")
                }
                Button("Void invoice", role: .destructive) { showVoid = true }
                    .disabled(isWorking)
            }
        }
    }

    @ViewBuilder
    private func sendButton(_ invoice: PaymentModels.InvoiceResponse) -> some View {
        let hasEmail = !(invoice.billingEmail?.trimmingCharacters(in: .whitespaces) ?? "").isEmpty
        let cooldown = resendCooldown(invoice)
        let verified = isEmailVerified
        Button {
            showSend = true
        } label: {
            VStack(alignment: .leading, spacing: 2) {
                Text(invoice.sentAt == nil ? "Send invoice" : "Resend invoice")
                if !hasEmail {
                    Text("This student needs an email before you can send.")
                        .font(.caption).foregroundStyle(.secondary)
                } else if !verified {
                    Text("Verify your email first")
                        .font(.caption).foregroundStyle(.secondary)
                } else if let cooldown {
                    Text("Last reminder sent — resend in \(cooldown)")
                        .font(.caption).foregroundStyle(.secondary)
                }
            }
        }
        .disabled(!hasEmail || !verified || cooldown != nil)
        .accessibilityIdentifier("invoice.send")
    }

    private var timelineSection: some View {
        Section("Activity") {
            if events.isEmpty {
                Text("No activity yet").foregroundStyle(.secondary)
            } else {
                ForEach(events) { event in
                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: eventIcon(event.type))
                            .foregroundStyle(eventColor(event.type))
                            .frame(width: 20)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(event.summary)
                                .font(.subheadline)
                            Text(InvoiceDerivations.formatDateTime(event.timestamp)
                                 + (event.actorName.map { " · \($0)" } ?? ""))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 2)
                }
            }
        }
    }

    // MARK: Helpers

    private func statusBadge(_ invoice: PaymentModels.InvoiceResponse) -> some View {
        BadgeView(label: InvoiceDerivations.statusLabel(invoice.status),
                  tone: PaymentsView.statusTone(invoice.status))
    }

    private func formatNumber(_ value: Double) -> String {
        value == value.rounded() ? String(format: "%.0f", value) : String(format: "%.2f", value)
    }

    private func eventIcon(_ type: String) -> String {
        switch type {
        case "sent", "resent": return "paperplane.fill"
        case "payment_received": return "checkmark.circle.fill"
        case "paid_online": return "creditcard.fill"
        case "voided": return "ban.fill"
        default: return "circle.fill"
        }
    }

    private func eventColor(_ type: String) -> Color {
        switch type {
        case "sent", "resent": return .blue
        case "payment_received", "paid_online": return .green
        case "voided": return .red
        default: return .secondary
        }
    }

    private var isEmailVerified: Bool {
        if case .signedIn(let user) = session.phase { return user.emailVerified ?? true }
        return true
    }

    private func resendCooldown(_ invoice: PaymentModels.InvoiceResponse, now: Date = .init()) -> String? {
        guard let sentAt = invoice.sentAt, let date = HomeDerivations.date(sentAt) else { return nil }
        let remaining = date.addingTimeInterval(LessonDerivations.invoiceResendCooldown).timeIntervalSince(now)
        guard remaining > 0 else { return nil }
        return LessonDerivations.formatMsRemaining(remaining)
    }

    // MARK: Data

    @MainActor
    private func load(isFatal: Bool = true) async {
        guard !isLoading else { return }
        isLoading = true
        if isFatal { message = nil }
        defer { isLoading = false }
        do {
            async let invoiceResult = session.authenticated { token in
                try await api.invoice(id: invoiceID, accessToken: token)
            }
            async let eventsResult = session.authenticated { token in
                try await api.events(id: invoiceID, accessToken: token)
            }
            let (loadedInvoice, loadedEvents) = try await (invoiceResult, eventsResult)
            try Task.checkCancellation()
            invoice = loadedInvoice
            events = loadedEvents
            hasLoaded = true
        } catch is CancellationError {
        } catch AuthFailure.cancelled {
        } catch {
            if isFatal {
                message = AuthFailure.message(for: error)
            }
        }
    }

    @MainActor
    private func markPaid() async {
        guard !isWorking else { return }
        isWorking = true
        defer { isWorking = false }
        do {
            invoice = try await session.authenticated { token in
                try await api.markPaid(id: invoiceID, accessToken: token)
            }
            await load(isFatal: false)
        } catch {
            fail(error)
        }
    }

    @MainActor
    private func voidInvoice() async {
        guard !isWorking else { return }
        isWorking = true
        defer { isWorking = false }
        do {
            invoice = try await session.authenticated { token in
                try await api.void(id: invoiceID, accessToken: token)
            }
            await load(isFatal: false)
        } catch {
            fail(error)
        }
    }

    private func fail(_ error: Error) {
        actionFailureMessage = AuthFailure.message(for: error)
        actionFailed = true
    }
}
