---
name: android-release-apk-build
description: Use when preparing, rebuilding, signing, verifying, or copying an Android release APK, or when showing a local web preview of an Android or Capacitor app on a PC. Provide safe PowerShell handoff commands, keep signing passwords out of files and chat, ask after a Git push whether the user wants to rebuild the release APK, and include local preview-server commands whenever asking the user to inspect the web UI.
---

# Android Release APK Build

## Safety

- Inspect the current project before producing commands.
- Resolve project-specific paths, APK names, signing-key paths, aliases, and available Android build-tools versions from the current project or ask the user.
- Never write a signing password in a file, code block, shell command, or chat message.
- Never add `.jks`, `.keystore`, or `key.properties` files to Git.
- Check that `.gitignore` excludes `*.jks`, `*.keystore`, and `key.properties`.
- Do not assume a release signing configuration exists in Gradle. If `assembleRelease` produces `app-release-unsigned.apk`, use `zipalign` and `apksigner`.

## After A Git Push

After confirming a successful Git push, ask:

`最新版のrelease APKを再ビルドしますか？`

Do not rebuild unless the user asks to proceed.

## Release APK Handoff

When the user asks to build the release APK, provide the first PowerShell commands together in one code block. Adapt paths, APK names, build-tools version, signing-key path, and alias to the project.

```powershell
cd C:\path\to\project
npm.cmd run build:web
npx.cmd cap sync android
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
cd android
.\gradlew.bat assembleRelease
& "$env:LOCALAPPDATA\Android\Sdk\build-tools\<version>\zipalign.exe" -f -p 4 ".\app\build\outputs\apk\release\app-release-unsigned.apk" ".\app\build\outputs\apk\release\<app-name>-release-aligned.apk"
& "$env:LOCALAPPDATA\Android\Sdk\build-tools\<version>\apksigner.bat" sign --ks "C:\path\to\release-key.jks" --ks-key-alias "<alias>" --out ".\app\build\outputs\apk\release\<app-name>-release.apk" ".\app\build\outputs\apk\release\<app-name>-release-aligned.apk"
```

After the signing command, write normal chat text telling the user to enter the signing-key password in PowerShell. Do not put this instruction inside the code block.

After the user has entered the password, provide verification and desktop-copy commands together in a second PowerShell code block:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\build-tools\<version>\apksigner.bat" verify --verbose ".\app\build\outputs\apk\release\<app-name>-release.apk"
Copy-Item ".\app\build\outputs\apk\release\<app-name>-release.apk" "C:\Users\<user>\Desktop\<app-name>-release.apk" -Force
```

## PC Web Preview Handoff

Whenever asking the user to inspect a web-screen change on a PC, always provide a paste-ready PowerShell code block:

```powershell
cd C:\path\to\project
npm.cmd run build:web
python -m http.server <port> --bind 127.0.0.1 --directory www
```

Then provide a clickable link:

`http://127.0.0.1:<port>`

- Tell the user to keep PowerShell open while previewing.
- Use the same preview port for the same project by default.
- Change the port only when the user asks or when the current port cannot be used.
- If the preview is stale, rebuild the web files and restart the existing server before changing ports.
