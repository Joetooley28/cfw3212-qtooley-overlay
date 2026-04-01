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

if (-not (Read-YesNo -Prompt "Proceed with install/update?" -DefaultYes $false)) {
    Write-Host "Install cancelled."
    exit 0
}

if ($transport.Name -eq "adb") {
    Push-PackageViaAdb -PackageRoot $packageRoot -RemoteStageRoot $remoteStageRoot
    Invoke-AdbShell "chmod 755 '$remoteScriptPath' && INSTALL_BUNDLED_OOKLA=$([int]$installOokla) /bin/sh '$remoteScriptPath'"
} else {
    Push-PackageViaSsh -PackageRoot $packageRoot -Target $transport.Target -RemoteStageRoot $remoteStageRoot
    Invoke-SshCommand -Target $transport.Target -Command "chmod 755 '$remoteScriptPath' && INSTALL_BUNDLED_OOKLA=$([int]$installOokla) /bin/sh '$remoteScriptPath'"
}

Write-Host "Install/update finished."
