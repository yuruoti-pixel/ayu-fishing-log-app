# Release APK Build Notes

## Current release APK

The Android release APK has been built successfully.

- Release APK: `android/app/build/outputs/apk/release/ayu-fishing-log-release.apk`
- Desktop copy: `C:\Users\wells\Desktop\ayu-fishing-log-release.apk`

## Signing key

- Signing key: `C:\Users\wells\Documents\AndroidKeys\ayu-fishing-log-release.jks`
- Key alias: `ayu-fishing-log`

Important:

- Do not add the signing key (`.jks`) to Git or GitHub.
- Do not write the signing key password in this repository.
- Keep the password in a separate secure location.
- Keep a secure backup of the signing key. Future updates must use the same key.

## Build flow after making changes

1. Generate the web files.
2. Sync the web files and Capacitor plugins to the Android project.
3. Build the unsigned release APK.
4. Align and sign the release APK with the existing release key.
5. Verify the signed APK.
6. Copy the APK to the desktop if needed.
7. Install and test the release APK on an Android device.

After a Git push, ask the user whether to rebuild the latest release APK. If the user asks to build it, provide the first group of PowerShell commands together:

```powershell
cd C:\Users\wells\Documents\Codex\ayu-fishing-log-app
npm.cmd run build:web
npx.cmd cap sync android
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
cd android
.\gradlew.bat assembleRelease
& "$env:LOCALAPPDATA\Android\Sdk\build-tools\37.0.0\zipalign.exe" -f -p 4 ".\app\build\outputs\apk\release\app-release-unsigned.apk" ".\app\build\outputs\apk\release\ayu-fishing-log-release-aligned.apk"
& "$env:LOCALAPPDATA\Android\Sdk\build-tools\37.0.0\apksigner.bat" sign --ks "C:\Users\wells\Documents\AndroidKeys\ayu-fishing-log-release.jks" --ks-key-alias "ayu-fishing-log" --out ".\app\build\outputs\apk\release\ayu-fishing-log-release.apk" ".\app\build\outputs\apk\release\ayu-fishing-log-release-aligned.apk"
```

After the signing command, tell the user in normal chat text to enter the signing-key password in PowerShell. Never write the password itself in a file, code block, or chat message.

After the password has been entered, provide the remaining commands together:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\build-tools\37.0.0\apksigner.bat" verify --verbose ".\app\build\outputs\apk\release\ayu-fishing-log-release.apk"
Copy-Item ".\app\build\outputs\apk\release\ayu-fishing-log-release.apk" "C:\Users\wells\Desktop\ayu-fishing-log-release.apk" -Force
```

## Debug and release APK differences

- A debug APK is intended for development and device testing. It is signed with a debug key.
- A release APK is intended for distribution. It is signed with the release key.
- A release APK should be used for ongoing real-world installation and updates.

## Switching from debug to release

The debug APK and release APK use different signing keys. Android may refuse to install the release APK over an installed debug APK.

If that happens:

1. Create a photo ZIP backup in the installed debug app.
2. Confirm that the backup file exists.
3. Uninstall the debug app.
4. Install the release APK.
5. Restore the photo ZIP backup in the release app.

Uninstalling the app removes its app-specific data, so confirm the backup before uninstalling.
