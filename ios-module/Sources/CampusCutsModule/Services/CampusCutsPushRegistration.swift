//
//  CampusCutsPushRegistration.swift
//  CampusCutsModule
//
//  Host apps (e.g. Intera) must register the APNs device token or push shows
//  "Found 0 registered devices" on the server. Call after sign-in from
//  `application(_:didRegisterForRemoteNotificationsWithDeviceToken:)`.
//

import Foundation

public enum CampusCutsPushRegistrationError: Error, Sendable {
    case invalidURL
    case httpStatus(Int, String?)
}

/// Registers `mobile_devices` via `POST /notifications/register-device` (same JWT as REST).
public enum CampusCutsPushRegistration: Sendable {
    /// Default API base including `/api/v1` (matches `CampusCutsAPIService`).
    public static let defaultAPIBaseURL = URL(string: "https://api.campuscut.com/api/v1")!

    /// - Parameters:
    ///   - deviceToken: Raw token from `didRegisterForRemoteNotificationsWithDeviceToken`.
    ///   - accessToken: Bearer JWT for the signed-in user.
    ///   - apnsEnvironment: `"sandbox"` for Xcode debug builds, `"production"` for TestFlight / App Store.
    ///   - apiBase: API root including `/api/v1`.
    public static func registerAPNsDevice(
        deviceToken: Data,
        accessToken: String,
        apnsEnvironment: String,
        apiBase: URL = CampusCutsPushRegistration.defaultAPIBaseURL
    ) async throws {
        let hex = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        struct Body: Encodable {
            let deviceToken: String
            let platform: String
            let apnsEnvironment: String
        }
        let body = Body(deviceToken: hex, platform: "ios", apnsEnvironment: apnsEnvironment)
        let url = apiBase.appendingPathComponent("notifications/register-device")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw CampusCutsPushRegistrationError.httpStatus(-1, nil)
        }
        guard (200...299).contains(http.statusCode) else {
            let msg = String(data: data, encoding: .utf8)
            throw CampusCutsPushRegistrationError.httpStatus(http.statusCode, msg)
        }
    }
}
