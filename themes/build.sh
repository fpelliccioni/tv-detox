#!/bin/sh
# Builds out/tvhome-themes.apk: the web page in web/ (React, built with Vite) inside a small native app.
# Needs Node 18+, Java 17 and the Android SDK (platform 34, build-tools 34), like ../build.sh.
# Signing: KEYSTORE and KEYSTORE_PASS, or a key.jks made on the first build (keep it for updates).
set -e
cd "$(dirname "$0")"

[ -n "$JAVA_HOME" ] || for j in /opt/homebrew/opt/openjdk@17 /usr/local/opt/openjdk@17 /usr/lib/jvm/java-17-openjdk-amd64; do [ -d "$j" ] && JAVA_HOME=$j && break; done
[ -n "$JAVA_HOME" ] && export PATH="$JAVA_HOME/bin:$PATH"
SDK=${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}
[ -n "$SDK" ] || for d in /opt/homebrew/share/android-commandlinetools "$HOME/Library/Android/sdk" "$HOME/Android/Sdk"; do [ -d "$d" ] && SDK=$d && break; done
BT=$SDK/build-tools/34.0.0; JAR=$SDK/platforms/android-34/android.jar
[ -f "$JAR" ] && [ -d "$BT" ] || { echo "Android SDK not found. Set ANDROID_HOME, and install platforms;android-34 and build-tools;34.0.0." >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm is missing: install Node 18 or later." >&2; exit 1; }

# The page.
(cd web && { [ -d node_modules ] || npm ci --no-audit --no-fund; } && npm run build)

rm -rf out; mkdir -p out/classes out/dex out/assets
cp -R web/dist out/assets/web

"$BT/aapt2" link -o out/base.apk -I "$JAR" --manifest android/AndroidManifest.xml -A out/assets \
  --min-sdk-version 24 --target-sdk-version 34
# shellcheck disable=SC2046 # one argument per file, on purpose
javac -nowarn -Xlint:-options -encoding UTF-8 -source 1.8 -target 1.8 -bootclasspath "$JAR:$BT/core-lambda-stubs.jar" \
  -d out/classes $(find android/src -name "*.java")
# shellcheck disable=SC2046
"$BT/d8" --min-api 24 --release --lib "$JAR" --output out/dex $(find out/classes -name '*.class')
cp out/base.apk out/unsigned.apk; (cd out/dex && zip -q ../unsigned.apk classes.dex)
"$BT/zipalign" -f 4 out/unsigned.apk out/aligned.apk

KS=${KEYSTORE:-key.jks}; PASS=${KEYSTORE_PASS:-tvhome123}
[ -f "$KS" ] || keytool -genkeypair -keystore "$KS" -storepass "$PASS" -keypass "$PASS" -alias tvhome \
  -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=tvhome" >/dev/null 2>&1
"$BT/apksigner" sign --ks "$KS" --ks-pass "pass:$PASS" --out out/tvhome-themes.apk out/aligned.apk
echo "Built out/tvhome-themes.apk"
