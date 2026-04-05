Place offline release bundle assets here when preparing a versioned ZIP.
The release build now downloads the expected Ookla archive automatically when it is not already present in this folder.

Expected Ookla archive path for offline installs:
- `bundles/ookla/ookla-speedtest-1.2.0-linux-armhf.tgz`

The installer will use the bundled archive automatically when it exists.
Public release ZIPs are expected to include this archive.
If it is missing during an ad-hoc build, the install flow leaves the current Ookla CLI state unchanged.
