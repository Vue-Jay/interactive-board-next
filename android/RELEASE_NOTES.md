# Android release notes

## 2026-11-25 — personal storage and database diagnostics

Release candidate based on validated production commit `aad7923fe806c89845b161b7286bd2d41efb2250` (PR #428).

- Show personal file storage, remaining quota and category breakdown on the tariff screen for Free and Pro accounts.
- Add administrator storage diagnostics, PostgreSQL table sizes, indexes, WAL when permitted, and per-account file usage.
- Preserve existing quota enforcement, data, signing identity and automatic in-app updates.

The existing signed APK and production network verification gates remain mandatory.

## 2026-11-24 — full canvas and coordinates

Release candidate based on validated production commit `157e26f86ee11813e78924a1b7e373ed0823c416` (PR #425).

- Keep the board canvas full-height behind the floating pen, marker and eraser controls.
- Create a square coordinate plane spanning −10 to +10 on both axes, with a unit grid and labels.
- Keep existing saved boards unchanged.

The existing signed APK and production network verification gates remain mandatory.

## 2026-11-24

Release candidate based on production commit `248788b71a0efcab976e6c5b1957273d1e1ab7e4`.

- Include the latest coordinate-plane scale, range and axis-label corrections.
- Restore core board toolbar defaults and isolate role-specific preferences (PR #423).
- Preserve the existing production package identifier and signing certificate.

The Android version code and version name are assigned by the native build workflow. Publication must pass its existing signed APK and production network verification gates; this note does not indicate that the release is already published.
