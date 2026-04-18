//
//  StudentBookingsViewModel.swift
//  CampusCuts
//
//  Consumer bookings list: GET /api/v2/bookings, segment filtering, hide past from list.
//

import Foundation
import SwiftUI

@MainActor
final class StudentBookingsViewModel: ObservableObject {
    @Published var items: [BookingListItem] = []
    @Published var hiddenPastIds: Set<String> = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let network = NetworkManager.shared
    private let removedStore = RemovedPastBookingsStore.shared

    init() {
        hiddenPastIds = removedStore.hiddenIds()
    }

    func fetchBookings() async {
        isLoading = true
        errorMessage = nil
        do {
            struct BookingsV2Response: Decodable {
                let success: Bool
                let data: [BookingListItem]
            }
            let response: BookingsV2Response = try await network.requestSnakeCaseJSON(
                endpoint: Constants.API.Endpoints.v2BookingsList,
                authenticated: true
            )
            items = response.data
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    /// Hide a past booking from the Past list on this device only.
    func removePastBookingFromList(id: String) {
        removedStore.hide(bookingId: id)
        hiddenPastIds = removedStore.hiddenIds()
    }

    func visibleItems(for filter: BookingListSegment) -> [BookingListItem] {
        items.filter { item in
            guard Self.listCategory(for: item) == filter else { return false }
            if filter == .past, hiddenPastIds.contains(item.id) {
                return false
            }
            return true
        }
    }

    static func listCategory(for item: BookingListItem) -> BookingListSegment {
        let s = item.status?.lowercased() ?? ""
        if s.contains("cancel") || s.contains("reject") {
            return .cancelled
        }
        if ["completed", "paid", "done"].contains(s) {
            return .past
        }
        if let slot = item.requestedSlot, slot < Date() {
            return .past
        }
        return .upcoming
    }

    func cancelBooking(uuid: String, reason: String?) async -> Bool {
        isLoading = true
        errorMessage = nil
        do {
            struct CancelBody: Codable {
                let reason: String?
            }
            struct CancelResponse: Decodable {
                let success: Bool
            }
            let _: CancelResponse = try await network.request(
                endpoint: Constants.API.Endpoints.v2CancelBooking(id: uuid),
                method: "POST",
                body: CancelBody(reason: reason),
                authenticated: true
            )
            await fetchBookings()
            isLoading = false
            return true
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
            return false
        }
    }
}
