param(
    [string]$RepoRoot = ""
)

if (-not $RepoRoot) {
    $candidates = @(
        $PSScriptRoot,
        (Split-Path -Parent $PSScriptRoot),
        (Get-Location).Path
    ) | Where-Object { $_ } | Select-Object -Unique

    foreach ($candidate in $candidates) {
        if ((Test-Path (Join-Path $candidate "scripts\stock_ui_at_release_common.ps1")) -and
            (Test-Path (Join-Path $candidate "router-files\stock-ui-at"))) {
            $RepoRoot = $candidate
            break
        }
    }
}

if (-not $RepoRoot) {
    throw "Unable to resolve RepoRoot automatically from the extracted installer folder. Open PowerShell in the extracted ZIP root and run this script there, or pass -RepoRoot explicitly for local dev use."
}

. (Join-Path $RepoRoot "scripts\stock_ui_at_release_common.ps1")

$packageRoot = Get-StockUiPackageRoot -RepoRoot $RepoRoot
$remoteStageRoot = "/tmp/qtooley-stock-ui-at-package"
$remoteScriptPath = "$remoteStageRoot/package/uninstall_stock_ui_release.sh"

Write-Host "Qtooley stock UI uninstall"
$transport = Select-Transport -AllowAdb:$false
$mode = Read-MenuChoice -Prompt "Choose uninstall mode: 1) Remove Qtooley and bundled Ookla 2) Remove Qtooley, bundled Ookla, and Tailscale" -Allowed @("1", "2")
$removeTailscale = if ($mode -eq "2") { $true } else { $false }

if ($removeTailscale) {
    Write-Host "This mode removes Qtooley, bundled Ookla, and Tailscale."
} else {
    Write-Host "This mode removes Qtooley and bundled Ookla, but leaves Tailscale installed."
    Write-Host "If you keep Tailscale, it will remain usable only from the CLI after the Qtooley UI is removed."
}

if (-not (Read-YesNo -Prompt "Proceed with uninstall?" -DefaultYes $false)) {
    Write-Host "Uninstall cancelled."
    exit 0
}

if ($transport.Name -eq "adb") {
    Push-PackageViaAdb -PackageRoot $packageRoot -RemoteStageRoot $remoteStageRoot
    Invoke-AdbShell "chmod 755 '$remoteScriptPath' && REMOVE_TAILSCALE=$([int]$removeTailscale) REMOVE_PAYLOAD=1 /bin/sh '$remoteScriptPath'"
} else {
    Push-PackageViaSsh -PackageRoot $packageRoot -Target $transport.Target -RemoteStageRoot $remoteStageRoot
    Invoke-SshCommand -Target $transport.Target -Command "chmod 755 '$remoteScriptPath' && REMOVE_TAILSCALE=$([int]$removeTailscale) REMOVE_PAYLOAD=1 /bin/sh '$remoteScriptPath'"
}

Write-Host "Uninstall finished."
