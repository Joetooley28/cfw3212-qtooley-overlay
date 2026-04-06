Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Read-MenuChoice {
    param(
        [string]$Prompt,
        [string[]]$Allowed
    )

    while ($true) {
        $value = (Read-Host $Prompt).Trim()
        if ($Allowed -contains $value) {
            return $value
        }
        Write-Host "Enter one of: $($Allowed -join ', ')"
    }
}

function Read-YesNo {
    param(
        [string]$Prompt,
        [bool]$DefaultYes = $true
    )

    $suffix = if ($DefaultYes) { "[Y/n]" } else { "[y/N]" }
    while ($true) {
        $value = (Read-Host "$Prompt $suffix").Trim().ToLowerInvariant()
        if (-not $value) {
            return $DefaultYes
        }
        if ($value -in @("y", "yes")) {
            return $true
        }
        if ($value -in @("n", "no")) {
            return $false
        }
        Write-Host "Enter y or n."
    }
}

function Get-StockUiPackageRoot {
    param(
        [string]$RepoRoot
    )

    $path = Join-Path $RepoRoot "router-files\stock-ui-at"
    if (-not (Test-Path $path)) {
        throw "Package root not found: $path"
    }
    return $path
}

function Get-BundledOoklaArchivePath {
    param(
        [string]$PackageRoot
    )

    return Join-Path $PackageRoot "usrdata\at-stock-ui\bundles\ookla\ookla-speedtest-1.2.0-linux-armhf.tgz"
}

function Assert-AdbAvailable {
    & adb version | Out-Null
}

function Assert-AdbDeviceConnected {
    $lines = (& adb devices) | Where-Object { $_ -match "\sdevice$" }
    if (-not $lines) {
        throw "No ADB device is connected."
    }
}

function Invoke-AdbShell {
    param(
        [string]$Command
    )

    & adb shell $Command | Out-Host
    if ($LASTEXITCODE -ne 0) {
        throw "ADB shell command failed."
    }
}

function Push-PackageViaAdb {
    param(
        [string]$PackageRoot,
        [string]$RemoteStageRoot
    )

    Invoke-AdbShell "rm -rf '$RemoteStageRoot'"
    Invoke-AdbShell "mkdir -p '$RemoteStageRoot'"

    Get-ChildItem -Force $PackageRoot | ForEach-Object {
        & adb push $_.FullName $RemoteStageRoot | Out-Host
        if ($LASTEXITCODE -ne 0) {
            throw "ADB push failed for $($_.Name)."
        }
    }
}

function Assert-SshAvailable {
    & cmd /c "ssh -V >nul 2>nul"
    if ($LASTEXITCODE -ne 0) {
        throw "ssh is not available."
    }

    & cmd /c "where scp >nul 2>nul"
    if ($LASTEXITCODE -ne 0) {
        throw "scp is not available."
    }
}

function Invoke-SshCommand {
    param(
        [string]$Target,
        [string]$Command
    )

    & ssh $Target $Command | Out-Host
    if ($LASTEXITCODE -ne 0) {
        throw "SSH command failed."
    }
}

function Push-PackageViaSsh {
    param(
        [string]$PackageRoot,
        [string]$Target,
        [string]$RemoteStageRoot
    )

    $parent = [System.IO.Path]::GetDirectoryName($RemoteStageRoot).Replace("\", "/")
    $tempTar = Join-Path ([System.IO.Path]::GetTempPath()) ("qtooley-stock-ui-" + [System.Guid]::NewGuid().ToString("N") + ".tar")
    $remoteTar = "$parent/qtooley-stock-ui-package.tar"

    try {
        Invoke-SshCommand -Target $Target -Command "rm -rf '$RemoteStageRoot' && mkdir -p '$parent' && mkdir -p '$RemoteStageRoot'"

        & tar -cf $tempTar -C $PackageRoot . | Out-Host
        if ($LASTEXITCODE -ne 0 -or -not (Test-Path $tempTar)) {
            throw "Local package tar creation failed."
        }

        & scp -O $tempTar "${Target}:$remoteTar" | Out-Host
        if ($LASTEXITCODE -ne 0) {
            throw "SCP package push failed."
        }

        Invoke-SshCommand -Target $Target -Command "tar -xf '$remoteTar' -C '$RemoteStageRoot' && rm -f '$remoteTar'"
    }
    finally {
        if (Test-Path $tempTar) {
            Remove-Item -Force $tempTar -ErrorAction SilentlyContinue
        }
    }
}

function Select-Transport {
    $choice = Read-MenuChoice -Prompt "Choose transport: 1) ADB 2) SSH" -Allowed @("1", "2")
    if ($choice -eq "1") {
        Assert-AdbAvailable
        Assert-AdbDeviceConnected
        return @{
            Name = "adb"
            Target = ""
        }
    }

    Assert-SshAvailable
    $routerHost = (Read-Host "Router IP or hostname").Trim()
    if (-not $routerHost) {
        throw "Router IP or hostname is required."
    }
    $user = (Read-Host "SSH username").Trim()
    if (-not $user) {
        throw "SSH username is required."
    }

    return @{
        Name = "ssh"
        Target = "$user@$routerHost"
    }
}

function Show-BundledOoklaStatus {
    param(
        [string]$PackageRoot
    )

    $archive = Get-BundledOoklaArchivePath -PackageRoot $PackageRoot
    if (Test-Path $archive) {
        Write-Host "Bundled Ookla archive found: $archive"
    } else {
        Write-Host "Bundled Ookla archive not found in this working tree."
    }
}
