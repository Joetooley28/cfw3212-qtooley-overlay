Place optional offline helper assets here only for local/private workflows.

Public release ZIPs should not include the Ookla CLI archive.
The public Qtooley flow now installs the Ookla CLI later from the router UI by downloading it directly from Ookla when the router already has working internet access.

If you are doing a private/local-only test and intentionally want to keep a manual archive around, the expected path is:
- `bundles/ookla/ookla-speedtest-1.2.0-linux-armhf.tgz`
