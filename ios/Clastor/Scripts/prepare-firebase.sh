#!/bin/sh
# Xcode supplies all paths through declared inputs/outputs, with sandboxing on.
set -eu

fail() {
    echo "error: $*" >&2
    exit 1
}

case "${APP_ENV:-}" in
    dev) expected_bundle=dev.chethin.Clastor.dev ;;
    staging) expected_bundle=dev.chethin.Clastor.staging ;;
    prod) expected_bundle=dev.chethin.Clastor ;;
    *) fail "Select a Clastor Dev, Clastor Staging, or Clastor scheme." ;;
esac
[ "${PRODUCT_BUNDLE_IDENTIFIER:-}" = "$expected_bundle" ] ||
    fail "The bundle identifier does not match APP_ENV."

case "${EXPECTED_FIREBASE_PROJECT_ID:-}" in
    ""|*REPLACE_WITH*|*'$('*)
        fail "Set EXPECTED_FIREBASE_PROJECT_ID for this environment." ;;
esac
case "${API_BASE_URL:-}" in
    ""|*REPLACE_WITH*|*'$('*|*'@'*|*'?'*|*'#'*|*' '*)
        fail "Set API_BASE_URL to an API origin without credentials, query, or fragment." ;;
    https://?*) ;;
    http://localhost|http://localhost:*|http://localhost/)
        [ "$APP_ENV" = dev ] || fail "HTTP localhost is allowed only for dev." ;;
    *) fail "API_BASE_URL must use HTTPS (dev may use HTTP localhost)." ;;
esac

source_path="${SCRIPT_INPUT_FILE_1:?Missing Firebase input path}"
destination_path="${SCRIPT_OUTPUT_FILE_0:?Missing Firebase output path}"
[ -f "$source_path" ] ||
    fail "Missing GoogleService-Info.plist for $APP_ENV. See ios/README.md."

read_value() {
    /usr/libexec/PlistBuddy -c "Print :$1" "$source_path" 2>/dev/null ||
        fail "Firebase config is missing $1."
}

[ "$(read_value BUNDLE_ID)" = "$expected_bundle" ] ||
    fail "Firebase plist BUNDLE_ID does not match this app."
[ "$(read_value PROJECT_ID)" = "$EXPECTED_FIREBASE_PROJECT_ID" ] ||
    fail "Firebase plist PROJECT_ID does not match this environment."
case "$(read_value GOOGLE_APP_ID)" in
    *:ios:?*) ;;
    *) fail "Use the Firebase Apple app config, not a web/Android config." ;;
esac
[ -n "$(read_value API_KEY)" ] || fail "Firebase config is missing API_KEY."

# Do not print the plist or its keys. The source stays outside the app source folder.
/bin/mkdir -p "$(dirname "$destination_path")"
/bin/cp "$source_path" "$destination_path"
echo "Firebase configuration selected for $APP_ENV."
