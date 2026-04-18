//
//  ConversationChatView.swift
//  CampusCuts
//
//  Conversation thread opened from a message push (`conversationId`).
//

import SwiftUI

private struct MessagesAPIResponse: Decodable {
    let success: Bool
    let data: MessagesDataDTO
}

private struct MessagesDataDTO: Decodable {
    let messages: [ChatMessageDTO]
}

private struct ChatMessageDTO: Decodable, Identifiable {
    let id: Int
    let content: String?
    let isOwn: Bool?
    let createdAt: Date?
}

private struct SendMessageBody: Codable {
    let content: String
}

private struct SendMessageAPIResponse: Decodable {
    let success: Bool
}

struct ConversationChatView: View {
    let conversationId: Int

    @Environment(\.dismiss) private var dismiss
    @State private var messages: [ChatMessageDTO] = []
    @State private var draft = ""
    @State private var loadError: String?
    @State private var isLoading = true
    @State private var isSending = false

    var body: some View {
        VStack(spacing: 0) {
            if let err = loadError, messages.isEmpty, !isLoading {
                ContentUnavailableView(
                    "Couldn’t load messages",
                    systemImage: "bubble.left.and.bubble.right",
                    description: Text(err)
                )
            } else {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 10) {
                            ForEach(messages) { m in
                                messageBubble(m)
                                    .id(m.id)
                            }
                        }
                        .padding()
                    }
                    .onChange(of: messages.count) { _ in
                        if let last = messages.last {
                            withAnimation {
                                proxy.scrollTo(last.id, anchor: .bottom)
                            }
                        }
                    }
                }
            }

            HStack(alignment: .bottom, spacing: 8) {
                TextField("Message", text: $draft, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .lineLimit(1...5)

                Button(action: { Task { await send() } }) {
                    if isSending {
                        ProgressView()
                    } else {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.title2)
                    }
                }
                .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSending)
            }
            .padding()
            .background(Color(.secondarySystemBackground))
        }
        .navigationTitle("Conversation")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Close") { dismiss() }
            }
        }
        .task {
            await refresh()
        }
    }

    @ViewBuilder
    private func messageBubble(_ m: ChatMessageDTO) -> some View {
        HStack {
            if m.isOwn == true { Spacer(minLength: 40) }
            VStack(alignment: m.isOwn == true ? .trailing : .leading, spacing: 4) {
                Text(m.content ?? "")
                    .padding(10)
                    .background(m.isOwn == true ? Color.blue.opacity(0.2) : Color(.secondarySystemBackground))
                    .cornerRadius(12)
                if let d = m.createdAt {
                    Text(d.formatted(date: .omitted, time: .shortened))
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
            if m.isOwn != true { Spacer(minLength: 40) }
        }
    }

    private func refresh() async {
        isLoading = true
        loadError = nil
        do {
            let response: MessagesAPIResponse = try await NetworkManager.shared.requestCamelCaseJSON(
                endpoint: Constants.API.Endpoints.conversationMessages(conversationId: conversationId),
                authenticated: true
            )
            messages = response.data.messages
        } catch {
            loadError = error.localizedDescription
        }
        isLoading = false
    }

    private func send() async {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        isSending = true
        draft = ""
        do {
            let body = SendMessageBody(content: text)
            let _: SendMessageAPIResponse = try await NetworkManager.shared.request(
                endpoint: Constants.API.Endpoints.sendConversationMessage(conversationId: conversationId),
                method: "POST",
                body: body,
                authenticated: true
            )
            await refresh()
        } catch {
            draft = text
            loadError = error.localizedDescription
        }
        isSending = false
    }
}

#Preview {
    NavigationStack {
        ConversationChatView(conversationId: 1)
    }
}
