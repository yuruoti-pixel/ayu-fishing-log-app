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
3. Build the signed release APK using the existing release signing setup.
4. Copy the APK to the desktop if needed.
5. Install and test the release APK on an Android device.

Run these commands in PowerShell:

```powershell
cd C:\Users\wells\Documents\Codex\ayu-fishing-log-app
```

```powershell
npm.cmd run build:web
```

```powershell
npx.cmd cap sync android
```

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
```

```powershell
cd C:\Users\wells\Documents\Codex\ayu-fishing-log-app\android
```

```powershell
.\gradlew.bat assembleRelease
```

```powershell
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
