param(
    [string]$RepoRoot = "C:\at_terminal\repo-public"
)

. (Join-Path $RepoRoot "scripts\stock_ui_at_release_common.ps1")

$packageRoot = Get-StockUiPackageRoot -RepoRoot $RepoRoot
$remoteStageRoot = "/tmp/qtooley-stock-ui-at-package"
$remoteScriptPath = "$remoteStageRoot/package/install_stock_ui_release.sh"

Write-Host "Qtooley stock UI install / update"
Show-BundledOoklaStatus -PackageRoot $packageRoot

$transport = Select-Transport
$installOokla = Read-YesNo -Prompt "Install bundled Ookla CLI if present?" -DefaultYes $true
$forceRecaptureBaseline = Read-YesNo -Prompt "Last-resort only: force recapture of the uninstall stock baseline from this router right now?" -DefaultYes $false

if ($forceRecaptureBaseline) {
    Write-Host "WARNING: forced baseline recapture should only be used when the saved uninstall baseline is missing or known-bad."
    Write-Host "WARNING: do this only on a box that is currently showing the stock UI you want uninstall to restore later."
    if (-not (Read-YesNo -Prompt "Proceed with FORCE_RECAPTURE_BASELINE=1?" -DefaultYes $false)) {
        Write-Host "Forced baseline recapture cancelled. Continuing with normal install/update."
        $forceRecaptureBaseline = $false
    }
}

if (-not (Read-YesNo -Prompt "Proceed with install/update?" -DefaultYes $false)) {
    Write-Host "Install cancelled."
    exit 0
}

if ($transport.Name -eq "adb") {
    Push-PackageViaAdb -PackageRoot $packageRoot -RemoteStageRoot $remoteStageRoot
    Invoke-AdbShell "chmod 755 '$remoteScriptPath' && INSTALL_BUNDLED_OOKLA=$([int]$installOokla) FORCE_RECAPTURE_BASELINE=$([int]$forceRecaptureBaseline) /bin/sh '$remoteScriptPath'"
} else {
    Push-PackageViaSsh -PackageRoot $packageRoot -Target $transport.Target -RemoteStageRoot $remoteStageRoot
    Invoke-SshCommand -Target $transport.Target -Command "chmod 755 '$remoteScriptPath' && INSTALL_BUNDLED_OOKLA=$([int]$installOokla) FORCE_RECAPTURE_BASELINE=$([int]$forceRecaptureBaseline) /bin/sh '$remoteScriptPath'"
}

Write-Host "Install/update finished."
