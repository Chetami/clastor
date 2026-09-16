//
//  ClastorApp.swift
//  Clastor
//
//  Created by Chethin Weerakkody on 16/9/2026.
//

import SwiftUI

@main
struct ClastorApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var session = SessionStore.live()
    @State private var studentStore = StudentStore()
    @State private var lessonStore = LessonStore()
    @State private var invoiceStore = InvoiceStore()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            ContentView(session: session)
                .environment(studentStore)
                .environment(lessonStore)
                .environment(invoiceStore)
                .task { await session.restore() }
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active {
                        Task { await session.becameActive() }
                    }
                }
        }
    }
}
