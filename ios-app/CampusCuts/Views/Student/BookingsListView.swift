import SwiftUI

struct BookingsListView: View {
    @StateObject private var viewModel = StudentBookingsViewModel()
    @State private var selectedSegment: BookingListSegment = .upcoming

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Picker("Filter", selection: $selectedSegment) {
                    ForEach(BookingListSegment.allCases) { segment in
                        Text(segment.rawValue).tag(segment)
                    }
                }
                .pickerStyle(.segmented)
                .padding()

                let rows = viewModel.visibleItems(for: selectedSegment)

                if viewModel.isLoading {
                    ProgressView("Loading bookings...")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let err = viewModel.errorMessage, viewModel.items.isEmpty {
                    ContentUnavailableView(
                        "Couldn’t load bookings",
                        systemImage: "exclamationmark.triangle",
                        description: Text(err)
                    )
                } else if rows.isEmpty {
                    ContentUnavailableView(
                        emptyTitle,
                        systemImage: "calendar.badge.clock",
                        description: Text(emptyDescription)
                    )
                } else {
                    List {
                        ForEach(rows) { booking in
                            NavigationLink(destination: BookingDetailView(booking: booking)) {
                                StudentBookingRowView(booking: booking)
                            }
                            .swipeActions(edge: .trailing, allowsFullSwipe: selectedSegment == .past) {
                                if selectedSegment == .past {
                                    Button(role: .destructive) {
                                        viewModel.removePastBookingFromList(id: booking.id)
                                    } label: {
                                        Label("Remove", systemImage: "eye.slash")
                                    }
                                }
                            }
                        }
                    }
                    .listStyle(.plain)
                }

                if selectedSegment == .past {
                    Text("Removed items stay hidden on this iPhone only.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                        .padding(.bottom, 8)
                }
            }
            .navigationTitle("My Bookings")
            .refreshable {
                await viewModel.fetchBookings()
            }
            .task {
                await viewModel.fetchBookings()
            }
            .onAppear {
                viewModel.hiddenPastIds = RemovedPastBookingsStore.shared.hiddenIds()
            }
        }
    }

    private var emptyTitle: String {
        switch selectedSegment {
        case .upcoming: return "No Upcoming Bookings"
        case .past: return "No Past Bookings"
        case .cancelled: return "No Cancelled Bookings"
        }
    }

    private var emptyDescription: String {
        switch selectedSegment {
        case .upcoming: return "You don’t have any upcoming appointments."
        case .past: return "Past appointments appear here. Swipe left on a row to remove it from this list."
        case .cancelled: return "You don’t have any cancelled bookings."
        }
    }
}

struct StudentBookingRowView: View {
    let booking: BookingListItem

    var body: some View {
        HStack(spacing: 12) {
            if let imageUrl = booking.barberImage {
                AsyncImage(url: URL(string: imageUrl)) { image in
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                } placeholder: {
                    ProgressView()
                }
                .frame(width: 60, height: 60)
                .clipShape(Circle())
            } else {
                Circle()
                    .fill(Color.blue.opacity(0.2))
                    .frame(width: 60, height: 60)
                    .overlay(
                        Image(systemName: "person.fill")
                            .foregroundColor(.blue)
                    )
            }

            VStack(alignment: .leading, spacing: 4) {
                if let barberName = booking.barberFullName {
                    Text(barberName)
                        .font(.headline)
                }

                Text(displayWhen)
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                if let location = booking.locationDetails {
                    Text(location)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }
            }

            Spacer()

            Text(statusLabel)
                .font(.caption)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(statusBackground)
                .foregroundColor(statusForeground)
                .cornerRadius(8)
        }
        .padding(.vertical, 4)
    }

    private var displayWhen: String {
        if let slot = booking.requestedSlot {
            return slot.formatted(date: .abbreviated, time: .shortened)
        }
        return booking.createdAt.formatted(date: .abbreviated, time: .shortened)
    }

    private var statusLabel: String {
        (booking.status ?? "—").replacingOccurrences(of: "_", with: " ").capitalized
    }

    private var statusBackground: Color {
        let s = booking.status?.lowercased() ?? ""
        if s.contains("cancel") { return Color.red.opacity(0.15) }
        if ["completed", "paid", "done"].contains(s) { return Color.green.opacity(0.15) }
        if s.contains("pending") { return Color.orange.opacity(0.2) }
        return Color.blue.opacity(0.15)
    }

    private var statusForeground: Color {
        let s = booking.status?.lowercased() ?? ""
        if s.contains("cancel") { return .red }
        if ["completed", "paid", "done"].contains(s) { return .green }
        if s.contains("pending") { return .orange }
        return .blue
    }
}

struct BookingDetailView: View {
    let booking: BookingListItem
    @Environment(\.dismiss) private var dismiss
    @State private var showingCancelConfirmation = false
    @State private var isCancelling = false

    private var category: BookingListSegment {
        StudentBookingsViewModel.listCategory(for: booking)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if let barberName = booking.barberFullName {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Barber")
                            .font(.headline)
                        Text(barberName)
                            .font(.title3)
                    }
                }

                Divider()

                VStack(alignment: .leading, spacing: 12) {
                    DetailRow(label: "Status", value: (booking.status ?? "—").replacingOccurrences(of: "_", with: " ").capitalized)

                    if let slot = booking.requestedSlot {
                        DetailRow(label: "Scheduled", value: slot.formatted(date: .long, time: .shortened))
                    } else {
                        DetailRow(label: "Created", value: booking.createdAt.formatted(date: .long, time: .shortened))
                    }

                    if let location = booking.locationDetails {
                        DetailRow(label: "Location", value: location)
                    }

                    if let requests = booking.notes {
                        DetailRow(label: "Notes", value: requests)
                    }
                }

                Divider()

                if category == .upcoming {
                    VStack(spacing: 12) {
                        Button(action: { showingCancelConfirmation = true }) {
                            Text("Cancel Booking")
                                .frame(maxWidth: .infinity)
                                .foregroundColor(.red)
                        }
                        .buttonStyle(.bordered)
                        .disabled(isCancelling)

                        Button(action: {}) {
                            Label("Message Barber", systemImage: "message.fill")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                    }
                }

                if category == .past {
                    Button(role: .destructive) {
                        RemovedPastBookingsStore.shared.hide(bookingId: booking.id)
                        dismiss()
                    } label: {
                        Label("Remove from Past list", systemImage: "eye.slash")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                }
            }
            .padding()
        }
        .navigationTitle("Booking Details")
        .confirmationDialog("Cancel Booking?", isPresented: $showingCancelConfirmation) {
            Button("Cancel Booking", role: .destructive) {
                Task {
                    await runCancel()
                }
            }
            Button("Keep Booking", role: .cancel) {}
        } message: {
            Text("Are you sure you want to cancel this booking?")
        }
    }

    private func runCancel() async {
        isCancelling = true
        struct CancelBody: Codable {
            let reason: String?
        }
        struct CancelResponse: Decodable {
            let success: Bool
        }
        do {
            let _: CancelResponse = try await NetworkManager.shared.request(
                endpoint: Constants.API.Endpoints.v2CancelBooking(id: booking.id),
                method: "POST",
                body: CancelBody(reason: nil),
                authenticated: true
            )
            dismiss()
        } catch {
            // Stay on screen; could surface error with @State
        }
        isCancelling = false
    }
}

struct DetailRow: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
            Text(value)
                .font(.body)
        }
    }
}

#Preview {
    BookingsListView()
}
