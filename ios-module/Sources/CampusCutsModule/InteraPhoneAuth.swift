//
//  InteraPhoneAuth.swift
//  CampusCutsModule
//
//  SMS OTP flow for Intera shell apps (no UserSession yet). Pair with POST /auth/register
//  using the same E.164 phone when creating an account.
//

import Foundation

// MARK: - Public types

/// Errors from unauthenticated OTP requests.
public enum InteraPhoneAuthError: Error, Sendable {
    case invalidURL
    case httpStatus(Int)
    case decoding
    case serverMessage(String)
}

/// Outcome of verifying a 6-digit SMS code.
public enum InteraPhoneAuthOutcome: Sendable {
    /// Existing user — supply tokens to your `UserSessionProtocol` implementation.
    case signedIn(accessToken: String, refreshToken: String, user: InteraPhoneAuthUser)
    /// Code valid, but no `users.phone_e164` match — continue with email signup (`POST /auth/register` with optional `phoneNumber`).
    case verifiedPendingAccount(phoneNumber: String)
}

/// User payload returned when phone OTP signs in an existing account (mirrors email login).
public struct InteraPhoneAuthUser: Codable, Sendable {
    public let id: String
    public let email: String
    public let firstName: String?
    public let lastName: String?
    public let role: String
    public let campusId: String?
    public let emailVerified: Bool?
    public let profilePictureUrl: String?
    public let hasBarberProfile: Bool?
    public let phoneNumber: String?
}

/// Pre-session SMS OTP client (no `Authorization` header).
public struct InteraPhoneAuth: Sendable {
    public let baseURL: URL

    /// Production API root including `/api/v1`.
    public static let defaultProductionBaseURL = URL(string: "https://api.campuscut.com/api/v1")!

    /// - Parameter baseURL: API root including `/api/v1`, e.g. `InteraPhoneAuth.defaultProductionBaseURL`
    public init(baseURL: URL? = nil) {
        self.baseURL = baseURL ?? Self.defaultProductionBaseURL
    }

    /// Sends a 6-digit code via SMS (`POST .../auth/request-otp`).
    public func requestOTP(phoneNumber: String) async throws {
        let body: [String: String] = ["phoneNumber": phoneNumber]
        let (data, status) = try await post(path: "auth/request-otp", body: body)
        guard (200...299).contains(status) else {
            if let msg = Self.parseErrorMessage(data: data) {
                throw InteraPhoneAuthError.serverMessage(msg)
            }
            throw InteraPhoneAuthError.httpStatus(status)
        }
    }

    /// Verifies the code; returns signed-in session or pending-account state (`POST .../auth/verify-otp`).
    public func verifyOTP(phoneNumber: String, code: String) async throws -> InteraPhoneAuthOutcome {
        let body: [String: String] = ["phoneNumber": phoneNumber, "code": code]
        let (data, status) = try await post(path: "auth/verify-otp", body: body)
        guard (200...299).contains(status) else {
            if let msg = Self.parseErrorMessage(data: data) {
                throw InteraPhoneAuthError.serverMessage(msg)
            }
            throw InteraPhoneAuthError.httpStatus(status)
        }
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let top = try decoder.decode(VerifyTop.self, from: data)
        let d = top.data
        if d.accountExists == true,
           let token = d.accessToken,
           let refresh = d.refreshToken,
           let user = d.user {
            return .signedIn(accessToken: token, refreshToken: refresh, user: user)
        }
        return .verifiedPendingAccount(phoneNumber: d.phoneNumber)
    }

    // MARK: - Private

    private func post(path: String, body: [String: String]) async throws -> (Data, Int) {
        guard let url = URL(string: path, relativeTo: baseURL)?.absoluteURL else {
            throw InteraPhoneAuthError.invalidURL
        }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: req)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        return (data, status)
    }

    private static func parseErrorMessage(data: Data) -> String? {
        struct E: Decodable {
            let error: Err?
            struct Err: Decodable { let message: String? }
        }
        return (try? JSONDecoder().decode(E.self, from: data))?.error?.message
    }

    private struct VerifyTop: Decodable {
        let data: VerifyData
    }

    private struct VerifyData: Decodable {
        let phoneNumber: String
        let verified: Bool?
        let accountExists: Bool?
        let user: InteraPhoneAuthUser?
        let accessToken: String?
        let refreshToken: String?
    }
}
