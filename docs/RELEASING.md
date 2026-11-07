# Releasing

Versioning is [SemVer](https://semver.org): `MAJOR.MINOR.PATCH`. First release: **1.0.0**.

- **patch**: bug fixes only.
- **minor**: new features, files still open as before.
- **major**: a change to the `.erd.json` format that older versions cannot read, or other breaking changes.

## Cut a release

```sh
npm run bump -- patch        # or minor | major | 1.2.3  (edits all 5 version places)
git commit -am "release v1.0.1"
git tag v1.0.1
git push origin main v1.0.1   # push the tag by name; --follow-tags skips lightweight tags
```

Pushing the tag runs `.github/workflows/release.yml`:

1. checks the tag equals the version in `package.json`, `tauri.conf.json` and `Cargo.toml` (fails otherwise),
2. runs lint and tests,
3. builds Linux (deb, rpm, AppImage), Windows (msi, exe) and macOS (Apple Silicon and Intel dmg),
4. publishes them on one GitHub release for the tag.

Builds are unsigned: Windows SmartScreen and macOS Gatekeeper will warn on first launch.

## Automatic updates

Installed apps check for a new version 3 seconds after start, download it quietly and install it. If a board has unsaved changes, the install waits and a toast offers **Restart now**, which asks about each unsaved board first (like closing the window). Help → Info has a **Check for updates** button.

How it works: every release contains `latest.json` plus a signed update package per system (`tauri-action` with `includeUpdaterJson`). The app reads `https://github.com/mnr73/erd-editor/releases/latest/download/latest.json`, checks the signature against the public key in `src-tauri/tauri.conf.json` (`plugins.updater.pubkey`) and only then installs.

### One-time setup (required, or the release workflow stops at its first step)

The signing key pair was generated with `npm run tauri signer generate`. The **public** key is committed. Keep the **private** key out of the repo and add it as GitHub secrets (Settings → Secrets and variables → Actions):

- `TAURI_SIGNING_PRIVATE_KEY`: the full content of the private key file
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: its password (empty if none; create the secret with an empty value)

**Back the private key up.** Without it no future release can update apps that are already installed; you would have to ship a new public key by a manual reinstall.

### If an installed app says the update signature is invalid

The key in the `TAURI_SIGNING_PRIVATE_KEY` secret is not the private half of `plugins.updater.pubkey` in `src-tauri/tauri.conf.json`. A release signed with another key can never be fixed afterwards: make a new release (bump, tag) with the right secret. The release workflow now checks this first (`scripts/check-signing-key.mjs`) and stops before building. To check by hand:

```sh
TAURI_SIGNING_PRIVATE_KEY="$(cat path/to/updater.key)" TAURI_SIGNING_PRIVATE_KEY_PASSWORD="" node scripts/check-signing-key.mjs
```

The secret must be the whole content of the `.key` file, not the `.pub` file.

### Notes

- On Linux the updater installs the AppImage payload, which works for AppImage users. A `.deb` / `.rpm` install is owned by the package manager, so those users should install the new package by hand (not tested).
- Version order matters: an app only updates to a **higher** version, so always bump (`npm run bump`) before tagging.
- A release made before this feature existed cannot update itself; the first update has to be installed by hand.
