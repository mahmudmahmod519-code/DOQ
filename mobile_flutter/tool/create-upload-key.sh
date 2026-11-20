#!/usr/bin/env bash
# Creates the Google Play UPLOAD key (run once, on your own computer — needs Java's keytool).
# Prints the values to paste into GitHub -> Settings -> Secrets and variables -> Actions.
# KEEP doq-upload-keystore.jks AND THE PASSWORD SAFE (password manager + an offline copy).
# Never commit the .jks file. If it is lost, request an upload-key reset in Play Console.
set -euo pipefail
OUT="${1:-$HOME/doq-upload-keystore.jks}"
ALIAS="${ALIAS:-upload}"
command -v keytool >/dev/null || { echo "keytool not found: install a JDK (e.g. sudo apt install openjdk-17-jdk-headless)"; exit 1; }
[[ -e "$OUT" ]] && { echo "$OUT already exists — not overwriting it."; exit 1; }

read -r -s -p "Choose a keystore password (min 6 chars): " PASS; echo
read -r -s -p "Repeat the password: " PASS2; echo
[[ "$PASS" == "$PASS2" && ${#PASS} -ge 6 ]] || { echo "Passwords do not match or too short"; exit 1; }

keytool -genkeypair -v -keystore "$OUT" -storetype PKCS12 -alias "$ALIAS" -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass "$PASS" -keypass "$PASS" -dname "CN=DOQ, OU=Mobile, O=DOQ, L=Cairo, C=EG" >/dev/null 2>&1
chmod 600 "$OUT"

echo
echo "Created $OUT"
echo "Add these GitHub secrets:"
echo "  ANDROID_KEYSTORE_PASSWORD = (the password you typed)"
echo "  ANDROID_KEY_PASSWORD      = (the same password)"
echo "  ANDROID_KEY_ALIAS         = $ALIAS"
echo "  ANDROID_KEYSTORE_BASE64   = the content of ${OUT}.base64.txt (created now; delete it after pasting)"
base64 -w0 "$OUT" > "${OUT}.base64.txt" 2>/dev/null || base64 "$OUT" | tr -d '\n' > "${OUT}.base64.txt"
chmod 600 "${OUT}.base64.txt"
echo
echo "Upload-key SHA-256 fingerprint (Play Console shows the same under App integrity):"
keytool -list -v -keystore "$OUT" -storepass "$PASS" -alias "$ALIAS" | grep -m1 'SHA256'
