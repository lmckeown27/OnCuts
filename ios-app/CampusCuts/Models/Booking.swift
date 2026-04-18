import Foundation

/// Segments on the consumer Bookings tab (Upcoming / Past / Cancelled).
enum BookingListSegment: String, CaseIterable, Identifiable {
    case upcoming = "Upcoming"
    case past = "Past"
    case cancelled = "Cancelled"

    var id: String { rawValue }
}

enum BookingStatus: String, Codable {
    case pending = "pending"
    case confirmed = "confirmed"
    case completed = "completed"
    case cancelled = "cancelled"
    
    var displayName: String {
        rawValue.capitalized
    }
    
    var color: String {
        switch self {
        case .pending: return "orange"
        case .confirmed: return "blue"
        case .completed: return "green"
        case .cancelled: return "red"
        }
    }
}

struct Booking: Identifiable, Codable {
    let id: String
    let blockchainBookingId: Int
    let barberId: String
    let clientId: String
    let locationDetails: String?
    let specialRequests: String?
    let reminderSent: Bool
    let notificationSent: Bool
    let createdAt: Date
    let updatedAt: Date
    
    // Additional fields from joins
    let barberFirstName: String?
    let barberLastName: String?
    let barberImage: String?
    let clientFirstName: String?
    let clientLastName: String?
    
    var barberFullName: String? {
        guard let first = barberFirstName, let last = barberLastName else { return nil }
        return "\(first) \(last)"
    }
    
    var clientFullName: String? {
        guard let first = clientFirstName, let last = clientLastName else { return nil }
        return "\(first) \(last)"
    }
    
    enum CodingKeys: String, CodingKey {
        case id
        case blockchainBookingId = "blockchain_booking_id"
        case barberId = "barber_id"
        case clientId = "client_id"
        case locationDetails = "location_details"
        case specialRequests = "special_requests"
        case reminderSent = "reminder_sent"
        case notificationSent = "notification_sent"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case barberFirstName = "barber_first_name"
        case barberLastName = "barber_last_name"
        case barberImage = "barber_image"
        case clientFirstName = "client_first_name"
        case clientLastName = "client_last_name"
    }
}

struct CreateBookingRequest: Codable {
    let barberId: String
    let serviceType: String
    let scheduledTime: String
    let durationMinutes: Int
    let locationDetails: String?
    let specialRequests: String?
}

/// Row from `GET /api/v2/bookings` (snake_case JSON).
struct BookingListItem: Identifiable, Codable, Equatable {
    let id: String
    let status: String?
    let requestedSlot: Date?
    let createdAt: Date
    let updatedAt: Date?
    let locationDetails: String?
    let notes: String?
    let barberFirstName: String?
    let barberLastName: String?
    let barberImage: String?
    let clientFirstName: String?
    let clientLastName: String?

    var barberFullName: String? {
        guard let first = barberFirstName, let last = barberLastName else { return nil }
        let t = "\(first) \(last)".trimmingCharacters(in: .whitespaces)
        return t.isEmpty ? nil : t
    }

    var clientFullName: String? {
        guard let first = clientFirstName, let last = clientLastName else { return nil }
        let t = "\(first) \(last)".trimmingCharacters(in: .whitespaces)
        return t.isEmpty ? nil : t
    }

    enum CodingKeys: String, CodingKey {
        case id
        case status
        case requestedSlot = "requested_slot"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case locationDetails = "location_details"
        case notes
        case specialRequests = "special_requests"
        case barberFirstName = "barber_first_name"
        case barberLastName = "barber_last_name"
        case barberImage = "barber_image"
        case clientFirstName = "consumer_first_name"
        case clientLastName = "consumer_last_name"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        status = try c.decodeIfPresent(String.self, forKey: .status)
        createdAt = try c.decode(Date.self, forKey: .createdAt)
        updatedAt = try c.decodeIfPresent(Date.self, forKey: .updatedAt)
        locationDetails = try c.decodeIfPresent(String.self, forKey: .locationDetails)
        notes = try c.decodeIfPresent(String.self, forKey: .notes)
            ?? try c.decodeIfPresent(String.self, forKey: .specialRequests)
        barberFirstName = try c.decodeIfPresent(String.self, forKey: .barberFirstName)
        barberLastName = try c.decodeIfPresent(String.self, forKey: .barberLastName)
        barberImage = try c.decodeIfPresent(String.self, forKey: .barberImage)
        clientFirstName = try c.decodeIfPresent(String.self, forKey: .clientFirstName)
        clientLastName = try c.decodeIfPresent(String.self, forKey: .clientLastName)
        if let slot = try c.decodeIfPresent(Date.self, forKey: .requestedSlot) {
            requestedSlot = slot
        } else {
            let alt = try decoder.container(keyedBy: AlternateKeys.self)
            requestedSlot = try alt.decodeIfPresent(Date.self, forKey: .requestedAt)
        }
    }

    private enum AlternateKeys: String, CodingKey {
        case requestedAt = "requested_at"
    }
}

struct BookingResponse: Codable {
    let success: Bool
    let data: BookingData
    let message: String?
}

struct BookingData: Codable {
    let booking: Booking
    let transactionHash: String
    
    enum CodingKeys: String, CodingKey {
        case booking
        case transactionHash = "transactionHash"
    }
}

