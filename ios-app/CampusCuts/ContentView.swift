import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @EnvironmentObject var notificationDeepLink: NotificationDeepLinkRouter

    var body: some View {
        Group {
            if authViewModel.isAuthenticated {
                Group {
                    if authViewModel.currentUser?.role == .barber {
                        BarberTabView()
                    } else {
                        StudentTabView()
                    }
                }
                .fullScreenCover(item: $notificationDeepLink.pending) { link in
                    switch link {
                    case .conversation(let conversationId):
                        NavigationStack {
                            ConversationChatView(conversationId: conversationId)
                        }
                    case .booking(let uuid):
                        NavigationStack {
                            BookingDeepLinkView(bookingId: uuid)
                        }
                    }
                }
            } else {
                LoginView()
            }
        }
    }
}

struct StudentTabView: View {
    var body: some View {
        TabView {
            DiscoveryView()
                .tabItem {
                    Label("Discover", systemImage: "scissors")
                }
            
            BookingsListView()
                .tabItem {
                    Label("Bookings", systemImage: "calendar")
                }
            
            StudentProfileView()
                .tabItem {
                    Label("Profile", systemImage: "person.fill")
                }
        }
        .accentColor(.blue)
    }
}

struct BarberTabView: View {
    var body: some View {
        TabView {
            BarberDashboardView()
                .tabItem {
                    Label("Dashboard", systemImage: "chart.bar.fill")
                }
            
            BarberCalendarView()
                .tabItem {
                    Label("Calendar", systemImage: "calendar")
                }
            
            EarningsView()
                .tabItem {
                    Label("Earnings", systemImage: "dollarsign.circle.fill")
                }
            
            BarberProfileView()
                .tabItem {
                    Label("Profile", systemImage: "person.fill")
                }
        }
        .accentColor(.green)
    }
}

#Preview {
    ContentView()
        .environmentObject(AuthViewModel())
        .environmentObject(NetworkManager())
        .environmentObject(NotificationDeepLinkRouter.shared)
}

