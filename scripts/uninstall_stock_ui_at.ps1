param(
    [string]$RepoRoot = "C:\at_terminal\repo-public"
)

. (Join-Path $RepoRoot "scripts\stock_ui_at_release_common.ps1")

$packageRoot = Get-StockUiPackageRoot -RepoRoot $RepoRoot
$remoteStageRoot = "/tmp/qtooley-stock-ui-at-package"
$remoteScriptPath = "$remoteStageRoot/package/uninstall_stock_ui_release.sh"

Write-Host "Qtooley stock UI uninstall"
$transport = Select-Transport
$mode = Read-MenuChoice -Prompt "Choose uninstall mode: 1) Remove Qtooley only 2) Remove Qtooley plus optional tool extras (Ookla and Tailscale)" -Allowed @("1", "2")
$removeOptional = if ($mode -eq "2") { $true } else { $false }

if ($removeOptional) {
    Write-Host "This mode removes Qtooley and also removes optional tool extras such as bundled Ookla and installed Tailscale."
} else {
    Write-Host "This mode removes Qtooley only and leaves optional tool extras such as Ookla and Tailscale in place."
}

if (-not (Read-YesNo -Prompt "Proceed with uninstall?" -DefaultYes $false)) {
    Write-Host "Uninstall cancelled."
    exit 0
}

if ($transport.Name -eq "adb") {
    Push-PackageViaAdb -PackageRoot $packageRoot -RemoteStageRoot $remoteStageRoot
    Invoke-AdbShell "chmod 755 '$remoteScriptPath' && REMOVE_OPTIONAL_RUNTIMES=$([int]$removeOptional) REMOVE_PAYLOAD=1 /bin/sh '$remoteScriptPath'"
} else {
    Push-PackageViaSsh -PackageRoot $packageRoot -Target $transport.Target -RemoteStageRoot $remoteStageRoot
    Invoke-SshCommand -Target $transport.Target -Command "chmod 755 '$remoteScriptPath' && REMOVE_OPTIONAL_RUNTIMES=$([int]$removeOptional) REMOVE_PAYLOAD=1 /bin/sh '$remoteScriptPath'"
}

Write-Host "Uninstall finished."
