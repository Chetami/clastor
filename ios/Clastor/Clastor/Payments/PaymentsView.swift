import SwiftUI

/// Invoices list — the Payments tab. Reads the shared InvoiceStore: the list
/// is cursor-paginated (20/page, infinite scroll) and stays fresh because
/// every invoice mutation flows through the store.
struct PaymentsView: View {
    let session: SessionStore

    @Environment(InvoiceStore.self) private var store
    @State private var showCreate = false

    private static let filters: [(value: String, label: String)] = [
        ("all", "All"), ("draft", "Draft"), ("open", "Open"),
        ("overdue", "Overdue"), ("paid", "Paid"), ("void", "Void"),
    ]

    var body: some View {
        List {
            Section {
                Picker("Status", selection: Binding(
                    get: { store.statusFilter },
                    set: { status in Task { await store.setFilter(status, session) } }
                )) {
                    ForEach(Self.filters, id: \.value) { filter in
                        Text(filter.label).tag(filter.value)
                    }
                }
                .pickerStyle(.segmented)
                .listRowBackground(Color.clear)
                .accessibilityIdentifier("payments.filter")
            }
            ForEach(store.invoices) { invoice in
                NavigationLink(value: InvoiceRoute(id: invoice.id)) {
                    invoiceRow(invoice)
                }
                .accessibilityIdentifier("payments.row.\(invoice.id)")
                .task {
                    // Infinite scroll: fetch the next page as the last row appears.
                    if invoice.id == store.invoices.last?.id {
                        await store.loadMore(session)
                    }
                }
            }
            if store.isLoadingMore {
                HStack {
                    Spacer()
                    ProgressView()
                    Spacer()
                }
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
            if store.isListLoading && store.invoices.isEmpty {
                ProgressView("Loading…")
            } else if let message = store.failureMessage, store.invoices.isEmpty {
                ContentUnavailableView {
                    Label("Could not load invoices", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(message)
                } actions: {
                    Button("Try again") { Task { await store.refresh(session) } }
                        .buttonStyle(.borderedProminent)
                }
            } else if store.isListLoaded, store.invoices.isEmpty {
                ContentUnavailableView("No invoices", systemImage: "doc.text",
                                        description: Text("Tap + to create your first invoice."))
            }
        }
        .task {
            await store.loadIfNeeded(session)
        }
        .refreshable { await store.refresh(session) }
        .sheet(isPresented: $showCreate) {
            CreateInvoiceView(session: session)
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
                BadgeView(label: InvoiceDerivations.statusLabel(invoice.status),
                         tone: Self.statusTone(invoice.status))
            }
        }
    }

    static func statusTone(_ status: String) -> LessonDerivations.BadgeTone {
        switch status {
        case "paid": return .emerald
        case "overdue": return .rose
        case "open": return .sky
        default: return .muted
        }
    }
}
