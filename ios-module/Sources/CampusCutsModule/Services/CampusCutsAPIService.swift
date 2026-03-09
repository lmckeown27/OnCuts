//
//  CampusCutsAPIService.swift
//  CampusCutsModule
//
//  Internal networking layer for CampusCuts API calls.
//  Uses the access token injected from the Shell's UserSession.
//

import Foundation

/// Internal API service for CampusCuts backend communication
internal class CampusCutsAPIService {
    private let session: UserSessionProtocol
    private let baseURL: URL
    private let jsonDecoder: JSONDecoder
    
    /// Initialize with user session for authentication
    /// - Parameter session: The user session containing access tokens
    init(session: UserSessionProtocol) {
        self.session = session
        self.baseURL = URL(string: "https://api.campuscut.com/api/v1")!
        
        self.jsonDecoder = JSONDecoder()
        self.jsonDecoder.keyDecodingStrategy = .convertFromSnakeCase
        self.jsonDecoder.dateDecodingStrategy = .iso8601
    }
    
    // MARK: - Generic Request Method
    
    private func request<T: Decodable>(
        endpoint: String,
        method: String = "GET",
        body: Data? = nil
    ) async throws -> T {
        guard var urlComponents = URLComponents(url: baseURL.appendingPathComponent(endpoint), resolvingAgainstBaseURL: true) else {
            throw CampusCutsAPIError.invalidURL
        }
        
        guard let url = urlComponents.url else {
            throw CampusCutsAPIError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let body = body {
            request.httpBody = body
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw CampusCutsAPIError.invalidResponse
        }
        
        switch httpResponse.statusCode {
        case 200...299:
            return try jsonDecoder.decode(T.self, from: data)
        case 401:
            // Token expired - try to refresh
            _ = try await session.refreshAccessToken()
            // Retry the request with new token
            return try await self.request(endpoint: endpoint, method: method, body: body)
        case 403:
            throw CampusCutsAPIError.forbidden
        case 404:
            throw CampusCutsAPIError.notFound
        default:
            throw CampusCutsAPIError.serverError(statusCode: httpResponse.statusCode)
        }
    }
    
    // MARK: - Barber Endpoints
    
    /// Fetch list of barbers for a campus
    func fetchBarbers(campusId: Int? = nil) async throws -> [Barber] {
        var endpoint = "barbers"
        if let campusId = campusId {
            endpoint += "?campus_id=\(campusId)"
        }
        return try await request(endpoint: endpoint)
    }
    
    /// Fetch barber availability for a specific date
    func fetchBarberAvailability(barberId: Int, date: String) async throws -> BarberAvailability {
        return try await request(endpoint: "barbers/\(barberId)/availability?date=\(date)")
    }
    
    /// Fetch barber profile
    func fetchBarberProfile(barberId: Int) async throws -> BarberProfile {
        return try await request(endpoint: "barbers/\(barberId)")
    }
    
    // MARK: - Booking Endpoints
    
    /// Fetch user's bookings
    func fetchBookings(status: String? = nil) async throws -> [Booking] {
        var endpoint = "bookings"
        if let status = status {
            endpoint += "?status=\(status)"
        }
        return try await request(endpoint: endpoint)
    }
    
    /// Create a new booking
    func createBooking(_ bookingRequest: CreateBookingRequest) async throws -> Booking {
        let body = try JSONEncoder().encode(bookingRequest)
        return try await request(endpoint: "bookings", method: "POST", body: body)
    }
    
    /// Update booking status
    func updateBookingStatus(bookingId: Int, status: String) async throws -> Booking {
        let body = try JSONEncoder().encode(["status": status])
        return try await request(endpoint: "bookings/\(bookingId)/status", method: "PATCH", body: body)
    }
    
    /// Cancel a booking
    func cancelBooking(bookingId: Int, reason: String?) async throws -> Booking {
        var payload: [String: String] = ["status": "CANCELLED"]
        if let reason = reason {
            payload["cancellation_reason"] = reason
        }
        let body = try JSONEncoder().encode(payload)
        return try await request(endpoint: "bookings/\(bookingId)/cancel", method: "POST", body: body)
    }
    
    // MARK: - Messages Endpoints
    
    /// Fetch messages for a booking
    func fetchMessages(bookingId: Int) async throws -> [Message] {
        return try await request(endpoint: "messages/booking/\(bookingId)")
    }
    
    /// Send a message
    func sendMessage(bookingId: Int, content: String) async throws -> Message {
        let body = try JSONEncoder().encode(["booking_id": bookingId, "content": content] as [String : Any])
        return try await request(endpoint: "messages", method: "POST", body: body)
    }
    
    // MARK: - Campus Endpoints
    
    /// Fetch list of campuses
    func fetchCampuses() async throws -> [Campus] {
        return try await request(endpoint: "campuses")
    }
    
    // MARK: - Services Endpoints
    
    /// Fetch services for a barber
    func fetchBarberServices(barberId: Int) async throws -> [BarberService] {
        return try await request(endpoint: "barbers/\(barberId)/services")
    }
    
    // MARK: - Review Endpoints
    
    /// Submit a review
    func submitReview(bookingId: Int, rating: Int, comment: String?) async throws -> Review {
        var payload: [String: Any] = ["booking_id": bookingId, "rating": rating]
        if let comment = comment {
            payload["comment"] = comment
        }
        let body = try JSONEncoder().encode(payload as [String : Any])
        return try await request(endpoint: "reviews", method: "POST", body: body)
    }
    
    /// Fetch reviews for a barber
    func fetchBarberReviews(barberId: Int) async throws -> [Review] {
        return try await request(endpoint: "barbers/\(barberId)/reviews")
    }
}

// MARK: - API Errors

internal enum CampusCutsAPIError: Error, LocalizedError {
    case invalidURL
    case invalidResponse
    case forbidden
    case notFound
    case serverError(statusCode: Int)
    case decodingError(Error)
    
    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid server response"
        case .forbidden:
            return "You don't have permission to access this resource"
        case .notFound:
            return "Resource not found"
        case .serverError(let statusCode):
            return "Server error (code: \(statusCode))"
        case .decodingError(let error):
            return "Failed to decode response: \(error.localizedDescription)"
        }
    }
}

