import Foundation

enum UserRole: String, Codable {
    case student
    case barber
}

struct User: Identifiable, Codable {
    let id: String
    let email: String
    let firstName: String
    let lastName: String
    let campusId: Int
    let role: UserRole
    let aptosAddress: String
    let emailVerified: Bool
    let studentIdVerified: Bool
    let createdAt: Date
    let isActive: Bool
    
    var fullName: String {
        "\(firstName) \(lastName)"
    }
    
    enum CodingKeys: String, CodingKey {
        case id, email, role
        case firstName = "first_name"
        case lastName = "last_name"
        case campusId = "campus_id"
        case aptosAddress = "aptos_address"
        case emailVerified = "email_verified"
        case studentIdVerified = "student_id_verified"
        case createdAt = "created_at"
        case isActive = "is_active"
    }
}

struct AuthResponse: Codable {
    let success: Bool
    let data: AuthData
    let message: String?
}

struct AuthData: Codable {
    let user: User
    /// Server returns `accessToken` on login / verify-email / Google; `token` is legacy.
    let accessToken: String
    let aptosAddress: String?
    
    enum CodingKeys: String, CodingKey {
        case user
        case accessToken
        case token
        case aptosAddress = "aptos_address"
    }
    
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        user = try c.decode(User.self, forKey: .user)
        if let at = try c.decodeIfPresent(String.self, forKey: .accessToken), !at.isEmpty {
            accessToken = at
        } else if let t = try c.decodeIfPresent(String.self, forKey: .token), !t.isEmpty {
            accessToken = t
        } else {
            throw DecodingError.dataCorruptedError(
                forKey: .accessToken,
                in: c,
                debugDescription: "Missing accessToken or token in auth response"
            )
        }
        aptosAddress = try c.decodeIfPresent(String.self, forKey: .aptosAddress)
    }
    
    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(user, forKey: .user)
        try c.encode(accessToken, forKey: .accessToken)
        try c.encodeIfPresent(aptosAddress, forKey: .aptosAddress)
    }
}

