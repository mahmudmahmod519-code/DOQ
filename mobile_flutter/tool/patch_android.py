#!/usr/bin/env python3
"""
Runs on CI right after `flutter create --platforms android .` (android/ is generated, not committed).

Always:
  - INTERNET / POST_NOTIFICATIONS / VIBRATE permissions, app name "دوق", DOQ launcher icons,
    our MainActivity (native notification + sound channel).
  - compileSdk / targetSdk >= 36 (Google Play requirement for new apps and updates since 31 Aug 2026).

Environment options:
  DOQ_APPLICATION_ID   Play package name (default com.doq.doq_customer). PERMANENT after the first Play upload.
  DOQ_ALLOW_CLEARTEXT  "true" allows http:// servers (LAN testing). Store builds use "false" (HTTPS only).
  DOQ_RELEASE_SIGNING  "true" signs release builds with android/key.properties (upload key) instead of the debug key.
"""
import glob
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ANDROID = os.path.join(ROOT, 'android')
MANIFEST = os.path.join(ANDROID, 'app', 'src', 'main', 'AndroidManifest.xml')

APP_ID = os.environ.get('DOQ_APPLICATION_ID', '').strip() or 'com.doq.doq_customer'
ALLOW_CLEARTEXT = os.environ.get('DOQ_ALLOW_CLEARTEXT', 'true').lower() == 'true'
RELEASE_SIGNING = os.environ.get('DOQ_RELEASE_SIGNING', 'false').lower() == 'true'
MIN_SDK_TARGET = 36

if not re.fullmatch(r'[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+', APP_ID):
    sys.exit(f'Invalid DOQ_APPLICATION_ID: {APP_ID}')
for required in ('tool/android/MainActivity.kt', 'tool/android/res/mipmap-xxxhdpi/ic_launcher.png'):
    if not os.path.exists(os.path.join(ROOT, required)):
        sys.exit(f'{required} is missing from the repository. It was probably git-ignored: '
                 'commit mobile_flutter/tool/android/ (git add -f mobile_flutter/tool/android) and push again.')
if not os.path.exists(MANIFEST):
    sys.exit('AndroidManifest.xml not found. Run `flutter create --platforms android .` first.')


def fail(msg):
    sys.exit(f'patch_android.py: {msg}')


# ---------------- Manifest ----------------
with open(MANIFEST, encoding='utf-8') as f:
    manifest = f.read()

permissions = [
    'android.permission.INTERNET',
    'android.permission.ACCESS_NETWORK_STATE',
    'android.permission.POST_NOTIFICATIONS',
    'android.permission.VIBRATE',
]
missing = [p for p in permissions if p not in manifest]
if missing:
    block = ''.join(f'    <uses-permission android:name="{p}" />\n' for p in missing)
    manifest = manifest.replace('<application', block + '    <application', 1)

manifest = re.sub(r'\s+android:usesCleartextTraffic="[^"]*"', '', manifest)
cleartext = 'true' if ALLOW_CLEARTEXT else 'false'
manifest = manifest.replace('<application', f'<application\n        android:usesCleartextTraffic="{cleartext}"', 1)
manifest = re.sub(r'android:label="[^"]*"', 'android:label="دوق"', manifest, count=1)

with open(MANIFEST, 'w', encoding='utf-8') as f:
    f.write(manifest)
print(f'manifest patched (cleartext={cleartext})')

# ---------------- MainActivity ----------------
generated = glob.glob(os.path.join(ANDROID, 'app', 'src', 'main', '**', 'MainActivity.*'), recursive=True)
target = os.path.join(ANDROID, 'app', 'src', 'main', 'kotlin', 'com', 'doq', 'doq_customer', 'MainActivity.kt')
for path in generated:
    if os.path.abspath(path) != os.path.abspath(target):
        os.remove(path)
os.makedirs(os.path.dirname(target), exist_ok=True)
shutil.copy(os.path.join(ROOT, 'tool', 'android', 'MainActivity.kt'), target)
print('MainActivity installed')

# ---------------- Icons ----------------
res_src = os.path.join(ROOT, 'tool', 'android', 'res')
res_dst = os.path.join(ANDROID, 'app', 'src', 'main', 'res')
for folder in os.listdir(res_src):
    os.makedirs(os.path.join(res_dst, folder), exist_ok=True)
    for name in os.listdir(os.path.join(res_src, folder)):
        shutil.copy(os.path.join(res_src, folder, name), os.path.join(res_dst, folder, name))
print('icons installed')

# ---------------- Gradle (Kotlin DSL or Groovy) ----------------
kts = os.path.join(ANDROID, 'app', 'build.gradle.kts')
groovy = os.path.join(ANDROID, 'app', 'build.gradle')
is_kts = os.path.exists(kts)
gradle_path = kts if is_kts else groovy
if not os.path.exists(gradle_path):
    fail('app/build.gradle(.kts) not found')
with open(gradle_path, encoding='utf-8') as f:
    gradle = f.read()


def sub_once(pattern, repl, text, what):
    new, n = re.subn(pattern, repl, text, count=1, flags=re.M)
    if n == 0:
        fail(f'could not patch {what} in {os.path.basename(gradle_path)}')
    return new


# applicationId (the namespace / Kotlin package stays com.doq.doq_customer)
gradle = sub_once(r'^(\s*applicationId\s*=?\s*)"[^"]*"', rf'\g<1>"{APP_ID}"', gradle, 'applicationId')

# SDK levels
if is_kts:
    gradle = sub_once(r'^(\s*compileSdk\s*=\s*).*$', rf'\g<1>maxOf(flutter.compileSdkVersion, {MIN_SDK_TARGET})', gradle, 'compileSdk')
    gradle = sub_once(r'^(\s*targetSdk\s*=\s*).*$', rf'\g<1>maxOf(flutter.targetSdkVersion, {MIN_SDK_TARGET})', gradle, 'targetSdk')
else:
    gradle = sub_once(r'^(\s*compileSdk(?:Version)?\s*=?\s*).*$', rf'\g<1>Math.max(flutter.compileSdkVersion, {MIN_SDK_TARGET})', gradle, 'compileSdk')
    gradle = sub_once(r'^(\s*targetSdk(?:Version)?\s*=?\s*).*$', rf'\g<1>Math.max(flutter.targetSdkVersion, {MIN_SDK_TARGET})', gradle, 'targetSdk')

if RELEASE_SIGNING:
    key_props = os.path.join(ANDROID, 'key.properties')
    if not os.path.exists(key_props):
        fail('DOQ_RELEASE_SIGNING=true but android/key.properties is missing')
    if is_kts:
        if 'import java.util.Properties' not in gradle:
            gradle = 'import java.io.FileInputStream\nimport java.util.Properties\n\n' + gradle
        loader = (
            '\nval keystoreProperties = Properties()\n'
            'val keystorePropertiesFile = rootProject.file("key.properties")\n'
            'if (keystorePropertiesFile.exists()) {\n'
            '    keystoreProperties.load(FileInputStream(keystorePropertiesFile))\n'
            '}\n\nandroid {'
        )
        signing = (
            '    signingConfigs {\n'
            '        create("release") {\n'
            '            keyAlias = keystoreProperties["keyAlias"] as String\n'
            '            keyPassword = keystoreProperties["keyPassword"] as String\n'
            '            storeFile = file(keystoreProperties["storeFile"] as String)\n'
            '            storePassword = keystoreProperties["storePassword"] as String\n'
            '        }\n'
            '    }\n\n'
            '    buildTypes {'
        )
        gradle = sub_once(r'^android\s*\{', loader.replace('\\', '\\\\'), gradle, 'android block')
        gradle = sub_once(r'^\s*buildTypes\s*\{', signing, gradle, 'buildTypes')
        gradle = sub_once(r'signingConfig\s*=\s*signingConfigs\.getByName\("debug"\)', 'signingConfig = signingConfigs.getByName("release")', gradle, 'release signingConfig')
    else:
        loader = (
            'def keystoreProperties = new Properties()\n'
            'def keystorePropertiesFile = rootProject.file("key.properties")\n'
            'if (keystorePropertiesFile.exists()) {\n'
            '    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))\n'
            '}\n\nandroid {'
        )
        signing = (
            '    signingConfigs {\n'
            '        release {\n'
            '            keyAlias keystoreProperties["keyAlias"]\n'
            '            keyPassword keystoreProperties["keyPassword"]\n'
            '            storeFile file(keystoreProperties["storeFile"])\n'
            '            storePassword keystoreProperties["storePassword"]\n'
            '        }\n'
            '    }\n\n'
            '    buildTypes {'
        )
        gradle = sub_once(r'^android\s*\{', loader, gradle, 'android block')
        gradle = sub_once(r'^\s*buildTypes\s*\{', signing, gradle, 'buildTypes')
        gradle = sub_once(r'signingConfig\s*=?\s*signingConfigs\.debug', 'signingConfig = signingConfigs.release', gradle, 'release signingConfig')
    print('release signing configured from android/key.properties')

with open(gradle_path, 'w', encoding='utf-8') as f:
    f.write(gradle)
print(f'{os.path.basename(gradle_path)} patched: applicationId={APP_ID}, targetSdk>={MIN_SDK_TARGET}')
