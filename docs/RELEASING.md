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
