//
//  RemovedPastBookingsStore.swift
//  CampusCuts
//
//  Persists booking UUIDs the user hid from the Past segment (this device only).
//

import Foundation

final class RemovedPastBookingsStore {
    static let shared = RemovedPastBookingsStore()

    private let key = "removed_past_booking_ids"

    private init() {}

    func hiddenIds() -> Set<String> {
        Set(UserDefaults.standard.stringArray(forKey: key) ?? [])
    }

    func hide(bookingId: String) {
        var next = hiddenIds()
        next.insert(bookingId)
        UserDefaults.standard.set(Array(next), forKey: key)
    }

    func unhide(bookingId: String) {
        var next = hiddenIds()
        next.remove(bookingId)
        UserDefaults.standard.set(Array(next), forKey: key)
    }
}
