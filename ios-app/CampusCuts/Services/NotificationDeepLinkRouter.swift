//
//  NotificationDeepLinkRouter.swift
//  CampusCuts
//
//  Routes APNs tap / cold-start opens to conversation or booking detail UI.
//

import Foundation
import SwiftUI

enum NotificationDeepLink: Identifiable, Equatable {
    case conversation(Int)
    case booking(uuid: String)

    var id: String {
        switch self {
        case .conversation(let n):
            return "conversation-\(n)"
        case .booking(let u):
            return "booking-\(u)"
        }
    }
}

@MainActor
final class NotificationDeepLinkRouter: ObservableObject {
    static let shared = NotificationDeepLinkRouter()

    @Published var pending: NotificationDeepLink?

    func applyPushUserInfo(_ userInfo: [AnyHashable: Any]) {
        let type = stringValue(userInfo["type"])?.lowercased()

        if type == "message" || type == "new_message" {
            if let cid = intValue(userInfo["conversationId"]) {
                pending = .conversation(cid)
            }
            return
        }

        switch type {
        case "booking_status",
             "booking_updated",
             "new_booking_request",
             "payment_request",
             "booking_confirmation",
             "booking_reminder",
             "payment_received",
             "new_review",
             "review":
            if let bid = stringValue(userInfo["bookingId"]), !bid.isEmpty {
                pending = .booking(uuid: bid)
            }
        default:
            break
        }
    }

    func clear() {
        pending = nil
    }

    private func stringValue(_ any: Any?) -> String? {
        if let s = any as? String { return s.isEmpty ? nil : s }
        if let n = any as? NSNumber { return n.stringValue }
        return nil
    }

    private func intValue(_ any: Any?) -> Int? {
        if let i = any as? Int { return i }
        if let n = any as? NSNumber { return n.intValue }
        if let s = any as? String { return Int(s) }
        return nil
    }
}
