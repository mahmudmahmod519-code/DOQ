#!/usr/bin/env python3
"""
Runs on CI right after `flutter create --platforms android .` (android/ is generated, not committed).
- Adds INTERNET / POST_NOTIFICATIONS / VIBRATE permissions and allows http:// servers (LAN testing).
- Sets the app name to "دوق".
- Replaces the generated MainActivity with ours (native notification + sound channel).
- Installs the DOQ launcher icons.
"""
import glob
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ANDROID = os.path.join(ROOT, 'android')
MANIFEST = os.path.join(ANDROID, 'app', 'src', 'main', 'AndroidManifest.xml')

if not os.path.exists(MANIFEST):
    sys.exit('AndroidManifest.xml not found. Run `flutter create --platforms android .` first.')

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

if 'usesCleartextTraffic' not in manifest:
    manifest = manifest.replace('<application', '<application\n        android:usesCleartextTraffic="true"', 1)

manifest = re.sub(r'android:label="[^"]*"', 'android:label="دوق"', manifest, count=1)

with open(MANIFEST, 'w', encoding='utf-8') as f:
    f.write(manifest)
print('manifest patched')

# MainActivity (Kotlin). flutter create puts it under kotlin/com/doq/doq_customer/
generated = glob.glob(os.path.join(ANDROID, 'app', 'src', 'main', '**', 'MainActivity.*'), recursive=True)
target = os.path.join(ANDROID, 'app', 'src', 'main', 'kotlin', 'com', 'doq', 'doq_customer', 'MainActivity.kt')
for path in generated:
    if os.path.abspath(path) != os.path.abspath(target):
        os.remove(path)
os.makedirs(os.path.dirname(target), exist_ok=True)
shutil.copy(os.path.join(ROOT, 'tool', 'android', 'MainActivity.kt'), target)
print('MainActivity installed at', os.path.relpath(target, ROOT))

# Launcher icons
res_src = os.path.join(ROOT, 'tool', 'android', 'res')
res_dst = os.path.join(ANDROID, 'app', 'src', 'main', 'res')
for folder in os.listdir(res_src):
    for name in os.listdir(os.path.join(res_src, folder)):
        os.makedirs(os.path.join(res_dst, folder), exist_ok=True)
        shutil.copy(os.path.join(res_src, folder, name), os.path.join(res_dst, folder, name))
print('icons installed')
