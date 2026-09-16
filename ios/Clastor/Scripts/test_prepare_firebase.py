"""Exercise the build-time environment boundary using synthetic, offline plists."""
import os
from pathlib import Path
import plistlib
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).with_name("prepare-firebase.sh")


class FirebaseBuildTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.folder = Path(self.temporary.name)
        self.source = self.folder / "source.plist"
        self.output = self.folder / "App.app/GoogleService-Info.plist"
        self.config = {
            "BUNDLE_ID": "dev.chethin.Clastor.dev",
            "PROJECT_ID": "test-project",
            "GOOGLE_APP_ID": "1:123456789:ios:0123456789abcdef",
            "API_KEY": "offline-fixture-not-a-real-api-key",
        }
        self.env = {
            **os.environ,
            "APP_ENV": "dev",
            "PRODUCT_BUNDLE_IDENTIFIER": "dev.chethin.Clastor.dev",
            "EXPECTED_FIREBASE_PROJECT_ID": "test-project",
            "API_BASE_URL": "http://localhost:3001",
            "SCRIPT_INPUT_FILE_1": str(self.source),
            "SCRIPT_OUTPUT_FILE_0": str(self.output),
        }

    def run_phase(self, create=True):
        if create:
            self.source.write_bytes(plistlib.dumps(self.config))
        result = subprocess.run(["/bin/sh", str(SCRIPT)], env=self.env, capture_output=True, text=True)
        self.assertNotIn(self.config.get("API_KEY", "never-print-a-key"), result.stdout + result.stderr)
        return result

    def assert_rejected(self, **kwargs):
        result = self.run_phase(**kwargs)
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(self.output.exists())
        return result

    def test_copies_only_the_selected_config(self):
        self.assertEqual(self.run_phase().returncode, 0)
        self.assertEqual(plistlib.loads(self.output.read_bytes()), self.config)

    def test_missing_config_fails(self):
        self.assert_rejected(create=False)

    def test_wrong_project_fails(self):
        self.config["PROJECT_ID"] = "another-project"
        self.assert_rejected()

    def test_wrong_bundle_fails(self):
        self.config["BUNDLE_ID"] = "dev.chethin.Clastor.staging"
        self.assert_rejected()

    def test_wrong_environment_bundle_fails(self):
        self.env["APP_ENV"] = "staging"
        self.assert_rejected()

    def test_staging_cannot_use_http(self):
        self.env.update(APP_ENV="staging", PRODUCT_BUNDLE_IDENTIFIER="dev.chethin.Clastor.staging")
        self.config["BUNDLE_ID"] = self.env["PRODUCT_BUNDLE_IDENTIFIER"]
        self.assert_rejected()

    def test_production_requires_explicit_settings(self):
        self.env.update(APP_ENV="prod", PRODUCT_BUNDLE_IDENTIFIER="dev.chethin.Clastor",
                        EXPECTED_FIREBASE_PROJECT_ID="", API_BASE_URL="")
        self.config["BUNDLE_ID"] = self.env["PRODUCT_BUNDLE_IDENTIFIER"]
        self.assert_rejected()

    def test_valid_staging_and_production(self):
        for environment in ["staging", "prod"]:
            with self.subTest(environment=environment):
                self.env.update(APP_ENV=environment, API_BASE_URL="https://api.example.test",
                                PRODUCT_BUNDLE_IDENTIFIER="dev.chethin.Clastor" + (".staging" if environment == "staging" else ""))
                self.config["BUNDLE_ID"] = self.env["PRODUCT_BUNDLE_IDENTIFIER"]
                self.assertEqual(self.run_phase().returncode, 0)

    def test_non_ios_or_incomplete_config_fails(self):
        self.config["GOOGLE_APP_ID"] = "1:123456789:android:0123456789abcdef"
        self.assert_rejected()
        self.config["GOOGLE_APP_ID"] = "1:123456789:ios:0123456789abcdef"
        del self.config["API_KEY"]
        self.assert_rejected()

    def test_placeholder_or_credential_urls_fail(self):
        for url in ["https://REPLACE_WITH_API", "https://user:password@api.example.test",
                    "https://api.example.test?token=value", "https://api.example.test#fragment"]:
            with self.subTest(url=url):
                self.env["API_BASE_URL"] = url
                self.assert_rejected()


if __name__ == "__main__":
    unittest.main()
