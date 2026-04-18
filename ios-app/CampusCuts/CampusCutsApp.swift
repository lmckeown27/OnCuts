import SwiftUI

@main
struct CampusCutsApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var authViewModel = AuthViewModel()
    @StateObject private var networkManager = NetworkManager()
    @ObservedObject private var notificationDeepLink = NotificationDeepLinkRouter.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(authViewModel)
                .environmentObject(networkManager)
                .environmentObject(notificationDeepLink)
        }
    }
}

