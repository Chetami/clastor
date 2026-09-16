import XCTest

final class ClastorUITests: XCTestCase {
    override func setUpWithError() throws { continueAfterFailure = false }

    @MainActor
    private func launch(scenario: String = "success") -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["--auth-ui-test"]
        app.launchEnvironment["AUTH_TEST_SCENARIO"] = scenario
        app.launch()
        XCTAssertTrue(app.textFields["login.email"].waitForExistence(timeout: 10))
        return app
    }

    @MainActor
    private func enterCredentials(_ app: XCUIApplication) {
        app.textFields["login.email"].tap()
        app.textFields["login.email"].typeText("tutor@example.test")
        app.secureTextFields["login.password"].tap()
        app.secureTextFields["login.password"].typeText("offline-test-password")
        app.buttons["login.submit"].tap()
    }

    @MainActor
    func testSignInAndSignOut() {
        let app = launch()
        XCTAssertFalse(app.buttons["login.submit"].isEnabled)
        enterCredentials(app)
        XCTAssertTrue(app.buttons["account.signOut"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["tutor@example.test"].exists)
        app.buttons["account.signOut"].tap()
        XCTAssertTrue(app.textFields["login.email"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["account.signOut"].exists)
    }

    @MainActor
    func testIncorrectPasswordShowsAnErrorAndClearsPassword() {
        let app = launch(scenario: "invalid-password")
        enterCredentials(app)
        XCTAssertTrue(app.staticTexts["login.error"].waitForExistence(timeout: 5))
        XCTAssertEqual(app.staticTexts["login.error"].label, "The email or password is incorrect.")
        XCTAssertEqual(app.textFields["login.email"].value as? String, "tutor@example.test")
        XCTAssertFalse(app.buttons["login.submit"].isEnabled)
        XCTAssertFalse(app.buttons["account.signOut"].exists)
    }

    @MainActor
    func testBackendFailureDoesNotOpenTheAccountScreen() {
        let app = launch(scenario: "backend-unavailable")
        enterCredentials(app)
        XCTAssertTrue(app.staticTexts["login.error"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["account.signOut"].exists)
    }
}
