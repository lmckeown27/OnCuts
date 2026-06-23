//
//  CampusCutsModuleBuilder.swift
//  CampusCutsModule
//
//  Public entry point for the Shell app to instantiate this module.
//  The Shell calls this factory to "spawn" the CampusCuts feature.
//

import SwiftUI

/// Factory class for building the CampusCuts module views
/// This is the ONLY public entry point the Shell needs to use
public struct CampusCutsModuleBuilder {
    
    /// Build the main CampusCuts home view
    /// - Parameter session: The user session conforming to UserSessionProtocol
    /// - Returns: The root view for the CampusCuts module
    @MainActor
    public static func build(with session: UserSessionProtocol) -> some View {
        let apiService = CampusCutsAPIService(session: session)
        let viewModel = CampusCutsHomeViewModel(session: session, apiService: apiService)
        return CampusCutsHomeView(viewModel: viewModel)
    }
    
    /// Build the barber dashboard view (for users with BARBER role)
    /// - Parameter session: The user session conforming to UserSessionProtocol
    /// - Returns: The barber dashboard view
    @MainActor
    public static func buildBarberDashboard(with session: UserSessionProtocol) -> some View {
        let apiService = CampusCutsAPIService(session: session)
        let viewModel = BarberDashboardViewModel(session: session, apiService: apiService)
        return BarberDashboardView(viewModel: viewModel)
    }
    
    /// Build the consumer booking view
    /// - Parameter session: The user session conforming to UserSessionProtocol
    /// - Returns: The consumer booking view
    @MainActor
    public static func buildConsumerView(with session: UserSessionProtocol) -> some View {
        let apiService = CampusCutsAPIService(session: session)
        let viewModel = ConsumerViewModel(session: session, apiService: apiService)
        return ConsumerHomeView(viewModel: viewModel)
    }
    
    /// Get the appropriate view based on user role
    /// - Parameter session: The user session conforming to UserSessionProtocol
    /// - Returns: Role-appropriate view (Consumer or Barber dashboard)
    @MainActor
    public static func buildRoleBasedView(with session: UserSessionProtocol) -> some View {
        switch session.userRole {
        case "BARBER", "ADMIN", "CAMPUS_MANAGER":
            return AnyView(buildBarberDashboard(with: session))
        default:
            return AnyView(buildConsumerView(with: session))
        }
    }
}

