Place offline release bundle assets here when preparing a versioned ZIP.

Expected Ookla archive path for offline installs:
- `bundles/ookla/ookla-speedtest-1.2.0-linux-armhf.tgz`

The installer will use the bundled archive automatically when it exists.
If it is missing, the install flow leaves the current Ookla CLI state unchanged.
