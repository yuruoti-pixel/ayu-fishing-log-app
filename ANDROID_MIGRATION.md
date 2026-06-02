# Android Migration Notes

- This folder is for the Android app version of Ayu Fishing Log.
- Do not modify the original PWA folder: `C:\Users\wells\Documents\Codex\ayu-fishing-log`.
- The next step is to run `npm install`.
- After reviewing the installed dependencies, the planned following step is `npx cap add android`.
- Existing storage, sharing, photo, backup, and restore behavior must not be replaced with Capacitor-specific behavior yet.

## Previewing the web screen on a PC

When checking visual changes on a PC, start the local preview server from a normal PowerShell window. Keep that PowerShell window open while previewing the app. Present the commands together in one PowerShell code block.

```powershell
cd C:\Users\wells\Documents\Codex\ayu-fishing-log-app
npm.cmd run build:web
python -m http.server 4178 --bind 127.0.0.1 --directory www
```

Then open:

`http://127.0.0.1:4178`

Use the same preview port by default. Change the port only when the user asks to change it or when the existing port cannot be used.

When asking the user to preview a web-screen change, always include the PowerShell commands needed to start the preview server in one code block.
