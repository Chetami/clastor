import SwiftUI

/// Invoices list — the Payments tab. Status filter maps to the same query
/// param as the web (unpaginated full fetch; mobile shows the latest set).
struct PaymentsView: View {
    let session: SessionStore

    @State private var api: any InvoiceServing = InvoiceAPI.live()
    @State private var statusFilter = "all"
    @State private var invoices: [PaymentModels.InvoiceResponse] = []
    @State private var isLoading = false
    @State private var hasLoaded = false
    @State private var message: String?
    @State private var showCreate = false

    private static let filters: [(value: String, label: String)] = [
        ("all", "All"), ("draft", "Draft"), ("open", "Open"),
        ("overdue", "Overdue"), ("paid", "Paid"), ("void", "Void"),
    ]

    var body: some View {
        List {
            Section {
                Picker("Status", selection: $statusFilter) {
                    ForEach(Self.filters, id: \.value) { filter in
                        Text(filter.label).tag(filter.value)
                    }
                }
                .pickerStyle(.segmented)
                .listRowBackground(Color.clear)
                .accessibilityIdentifier("payments.filter")
            }
            ForEach(invoices) { invoice in
                NavigationLink(value: InvoiceRoute(id: invoice.id)) {
                    invoiceRow(invoice)
                }
                .accessibilityIdentifier("payments.row.\(invoice.id)")
            }
        }
        .navigationTitle("Payments")
        .accessibilityIdentifier("payments.list")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showCreate = true
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityIdentifier("payments.add")
            }
        }
        .overlay {
            if isLoading && !hasLoaded {
                ProgressView("Loading…")
            } else if let message {
                ContentUnavailableView {
                    Label("Could not load invoices", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(message)
                } actions: {
                    Button("Try again") { Task { await load() } }
                        .buttonStyle(.borderedProminent)
                }
            } else if hasLoaded, invoices.isEmpty {
                ContentUnavailableView("No invoices", systemImage: "doc.text",
                                        description: Text("Tap + to create your first invoice."))
            }
        }
        .task {
            if !hasLoaded { await load() }
        }
        .refreshable { await load() }
        .onChange(of: statusFilter) {
            Task { await load() }
        }
        .onChange(of: showCreate) {
            if !showCreate { Task { await load(isFatal: false) } }
        }
        .sheet(isPresented: $showCreate) {
            CreateInvoiceView(session: session) {
                Task { await load(isFatal: false) }
            }
        }
    }

    private func invoiceRow(_ invoice: PaymentModels.InvoiceResponse) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 3) {
                Text(invoice.invoiceNumber)
                    .font(.subheadline.weight(.semibold))
                Text("\(invoice.customerName) · due \(InvoiceDerivations.formatDate(invoice.dueDate))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 3) {
                Text(InvoiceDerivations.formatCurrency(invoice.total, currency: invoice.currency))
                    .font(.subheadline.weight(.medium))
                invoiceBadge(invoice)
            }
        }
    }

    private func invoiceBadge(_ invoice: PaymentModels.InvoiceResponse) -> some View {
        BadgeView(label: InvoiceDerivations.statusLabel(invoice.status), tone: Self.statusTone(invoice.status))
    }

    static func statusTone(_ status: String) -> LessonDerivations.BadgeTone {
        switch status {
        case "paid": return .emerald
        case "overdue": return .rose
        case "open": return .sky
        default: return .muted
        }
    }

    @MainActor
    private func load(isFatal: Bool = true) async {
        guard !isLoading else { return }
        isLoading = true
        if isFatal { message = nil }
        defer { isLoading = false }
        do {
            let status = statusFilter
            invoices = try await session.authenticated { token in
                try await api.list(status: status, search: nil, accessToken: token)
            }
            hasLoaded = true
        } catch is CancellationError {
        } catch AuthFailure.cancelled {
        } catch {
            if isFatal {
                invoices = []
                hasLoaded = false
                message = AuthFailure.message(for: error)
            }
        }
    }
}
