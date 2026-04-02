//
//  CampusCutsRealtimeClient.swift
//  CampusCutsModule
//
//  Socket.IO client for live chat: join-personal (user inbox) + join-conversation (open thread).
//  Intera / host apps: after login call connect(); when opening a thread call joinConversation(id);
//  onNewMessage append to the UI if payload["conversation_id"] matches the open thread (dedupe by "id").
//  Use the same origin that serves `/socket.io/` (often https://campuscut.com, not only api.*).
//

import Foundation
import SocketIO

/// Real-time messaging via the same Socket.IO server as the web app (`/socket.io/`).
public final class CampusCutsRealtimeClient {
    private let socketURL: URL
    private let accessToken: String
    private let userId: String
    private var manager: SocketManager?
    private var socket: SocketIOClient?
    private var newMessageHandler: (([String: Any]) -> Void)?

    /// - Parameters:
    ///   - socketURL: Origin that proxies `/socket.io/` (e.g. `https://campuscut.com`). Not the REST `api.` host unless it also serves Socket.IO.
    ///   - accessToken: Same JWT as `Authorization: Bearer` for REST.
    ///   - userId: `users.id` UUID string — must match `join-personal` on web.
    public init(socketURL: URL, accessToken: String, userId: String) {
        self.socketURL = socketURL
        self.accessToken = accessToken
        self.userId = userId
    }

    public func connect() {
        disconnect()
        let config: SocketIOClientConfiguration = [
            .log(false),
            .compress,
            .secure(socketURL.scheme == "https"),
            .path("/socket.io/"),
            .reconnects(true),
            .reconnectAttempts(-1),
            .reconnectWait(1),
        ]
        let manager = SocketManager(socketURL: socketURL, config: config)
        self.manager = manager
        let socket = manager.defaultSocket
        self.socket = socket

        socket.on(clientEvent: .connect) { [weak self] _, _ in
            guard let self else { return }
            socket.emit("join-personal", self.userId)
        }

        socket.on("new-message") { [weak self] data, _ in
            guard let self else { return }
            if let dict = data.first as? [String: Any] {
                self.newMessageHandler?(dict)
            }
        }

        socket.connect()
    }

    public func disconnect() {
        socket?.disconnect()
        socket?.removeAllHandlers()
        socket = nil
        manager = nil
    }

    /// Call when the user opens a conversation screen (numeric or string id from REST).
    public func joinConversation(_ conversationId: String) {
        socket?.emit("join-conversation", conversationId)
    }

    public func leaveConversation(_ conversationId: String) {
        socket?.emit("leave-conversation", conversationId)
    }

    public func onNewMessage(_ handler: @escaping ([String: Any]) -> Void) {
        newMessageHandler = handler
    }

    public var isConnected: Bool {
        socket?.status == .connected
    }
}
