//
//  BookingDeepLinkView.swift
//  CampusCuts
//
//  Loads a single booking by UUID (from push `bookingId`) via GET /api/v2/bookings/:id.
//

import SwiftUI

private struct V2BookingSingleResponse: Decodable {
    let success: Bool
    let data: V2BookingDetailDTO
}

private struct V2BookingDetailDTO: Decodable {
    let id: String
    let status: String?
    let serviceType: String?
    let serviceName: String?
    let requestedSlot: Date?
    let requestedAt: Date?
    let locationDetails: String?
    let notes: String?
    let consumerFirstName: String?
    let consumerLastName: String?
    let barberFirstName: String?
    let barberLastName: String?
}

struct BookingDeepLinkView: View {
    let bookingId: String

    @Environment(\.dismiss) private var dismiss
    @State private var detail: V2BookingDetailDTO?
    @State private var loadError: String?
    @State private var isLoading = true

    var body: some View {
        Group {
            if isLoading {
                ProgressView("Loading booking…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let err = loadError {
                ContentUnavailableView(
                    "Couldn’t load booking",
                    systemImage: "exclamationmark.triangle",
                    description: Text(err)
                )
            } else if let b = detail {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        if let st = b.status?.capitalized {
                            Text(st)
                                .font(.caption)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(Color.orange.opacity(0.15))
                                .cornerRadius(8)
                        }

                        if let service = (b.serviceType ?? b.serviceName), !service.isEmpty {
                            labeled("Service", service)
                        }

                        if let t = b.requestedSlot ?? b.requestedAt {
                            labeled("When", t.formatted(date: .abbreviated, time: .shortened))
                        }

                        if let loc = b.locationDetails, !loc.isEmpty {
                            labeled("Location / details", loc)
                        }

                        if let notes = b.notes, !notes.isEmpty {
                            labeled("Notes", notes)
                        }

                        let otherParty = [b.consumerFirstName, b.consumerLastName].compactMap { $0 }.joined(separator: " ")
                        let barberParty = [b.barberFirstName, b.barberLastName].compactMap { $0 }.joined(separator: " ")
                        if !otherParty.isEmpty {
                            labeled("Consumer", otherParty)
                        }
                        if !barberParty.isEmpty {
                            labeled("Barber", barberParty)
                        }

                        labeled("Booking ID", b.id)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .padding()
                }
            }
        }
        .navigationTitle("Booking details")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Close") { dismiss() }
            }
        }
        .task {
            await load()
        }
    }

    private func labeled(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
            Text(value)
                .font(.body)
        }
    }

    private func load() async {
        isLoading = true
        loadError = nil
        do {
            let response: V2BookingSingleResponse = try await NetworkManager.shared.requestSnakeCaseJSON(
                endpoint: Constants.API.Endpoints.v2BookingDetail(id: bookingId),
                authenticated: true
            )
            detail = response.data
        } catch {
            loadError = error.localizedDescription
        }
        isLoading = false
    }
}

#Preview {
    NavigationStack {
        BookingDeepLinkView(bookingId: "00000000-0000-0000-0000-000000000000")
    }
}
