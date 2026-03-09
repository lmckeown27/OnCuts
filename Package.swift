// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CampusCutsModule",
    platforms: [
        .iOS(.v17),
        .macOS(.v14)
    ],
    products: [
        .library(
            name: "CampusCutsModule",
            targets: ["CampusCutsModule"]
        ),
    ],
    dependencies: [
        // Add external dependencies here if needed
        // .package(url: "https://github.com/stripe/stripe-ios", from: "23.0.0")
    ],
    targets: [
        .target(
            name: "CampusCutsModule",
            dependencies: [],
            path: "ios-module/Sources/CampusCutsModule",
            resources: [.process("Resources")]
        ),
        .testTarget(
            name: "CampusCutsModuleTests",
            dependencies: ["CampusCutsModule"],
            path: "ios-module/Tests/CampusCutsModuleTests"
        )
    ]
)

