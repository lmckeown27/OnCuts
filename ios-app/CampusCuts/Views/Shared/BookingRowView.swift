//
//  BookingRowView.swift
//  CampusCuts
//
//  Row for legacy `Booking` model (e.g. barber calendar / dashboard).
//

import SwiftUI

struct BookingRowView: View {
    let booking: Booking

    var body: some View {
        HStack(spacing: 12) {
            if let imageUrl = booking.barberImage {
                AsyncImage(url: URL(string: imageUrl)) { image in
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                } placeholder: {
                    ProgressView()
                }
                .frame(width: 60, height: 60)
                .clipShape(Circle())
            } else {
                Circle()
                    .fill(Color.blue.opacity(0.2))
                    .frame(width: 60, height: 60)
                    .overlay(
                        Image(systemName: "person.fill")
                            .foregroundColor(.blue)
                    )
            }

            VStack(alignment: .leading, spacing: 4) {
                if let barberName = booking.barberFullName {
                    Text(barberName)
                        .font(.headline)
                }

                Text(booking.createdAt.formatted(date: .abbreviated, time: .shortened))
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                if let location = booking.locationDetails {
                    Text(location)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }
            }

            Spacer()

            Text("Pending")
                .font(.caption)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.orange.opacity(0.2))
                .foregroundColor(.orange)
                .cornerRadius(8)
        }
        .padding(.vertical, 4)
    }
}
