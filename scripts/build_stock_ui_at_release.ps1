param(
    [string]$RepoRoot = "C:\at_terminal\repo-public",
    [string]$ReleaseVersion = "",
    [string]$OutputRoot = "C:\at_terminal\repo-public\dist",
    [string]$OoklaBundleSource = "",
    [string]$OoklaBundleUrl = "https://install.speedtest.net/app/cli/ookla-speedtest-1.2.0-linux-armhf.tgz"
)

$ErrorActionPreference = "Stop"

function Get-VersionText {
    param(
        [string]$RepoPath,
        [string]$Requested
    )

    if ($Requested) {
        return $Requested
    }

    $releaseFile = Join-Path $RepoPath "router-files\stock-ui-at\usrdata\at-stock-ui\JTOOLS_RELEASE.txt"
    if (Test-Path $releaseFile) {
        $line = Get-Content $releaseFile | Where-Object { $_ -match '^Release label:' } | Select-Object -First 1
        if ($line) {
            return ($line -replace '^Release label:\s*', '').Trim()
        }
    }

    return "working"
}

function Ensure-OoklaBundle {
    param(
        [string]$ReleasePackageRoot,
        [string]$RequestedSource,
        [string]$DownloadUrl
    )

    $bundleDir = Join-Path $ReleasePackageRoot "usrdata\at-stock-ui\bundles\ookla"
    $bundlePath = Join-Path $bundleDir "ookla-speedtest-1.2.0-linux-armhf.tgz"
    New-Item -ItemType Directory -Force -Path $bundleDir | Out-Null

    if (Test-Path $bundlePath) {
        Write-Output "Bundled Ookla archive already present: $bundlePath"
        return
    }

    if ($RequestedSource) {
        if (-not (Test-Path $RequestedSource)) {
            throw "Requested Ookla bundle source not found: $RequestedSource"
        }

        Copy-Item -Force $RequestedSource $bundlePath
        Write-Output "Bundled Ookla archive copied from local source: $RequestedSource"
        return
    }

    Write-Output "Downloading bundled Ookla archive for release packaging..."
    try {
        Invoke-WebRequest -Uri $DownloadUrl -OutFile $bundlePath
    } catch {
        throw "Failed to download bundled Ookla archive from $DownloadUrl. $($_.Exception.Message)"
    }

    if (-not (Test-Path $bundlePath) -or ((Get-Item $bundlePath).Length -le 0)) {
        throw "Downloaded Ookla bundle is missing or empty: $bundlePath"
    }

    Write-Output "Bundled Ookla archive added to release package: $bundlePath"
}

function Get-ReleaseToken {
    param(
        [string]$Version
    )

    $sanitized = ($Version.ToLowerInvariant() -replace '[^a-z0-9]+', '-').Trim('-')
    if (-not $sanitized) {
        $sanitized = Get-Date -Format "yyyyMMddHHmmss"
    }
    return "rel-$sanitized"
}

function Replace-InFile {
    param(
        [string]$Path,
        [string]$Pattern,
        [string]$Replacement
    )

    if (-not (Test-Path $Path)) {
        return
    }

    $content = [System.IO.File]::ReadAllText($Path)
    $updated = [System.Text.RegularExpressions.Regex]::Replace($content, $Pattern, $Replacement)
    if ($updated -ne $content) {
        [System.IO.File]::WriteAllText($Path, $updated, (New-Object System.Text.UTF8Encoding($false)))
    }
}

function Apply-ReleaseCacheTokens {
    param(
        [string]$ReleasePackageRoot,
        [string]$Version
    )

    $token = Get-ReleaseToken -Version $Version
    $htmlFiles = Get-ChildItem (Join-Path $ReleasePackageRoot "www") -Filter *.html -File -Recurse
    $pageUrlFiles = @(
        Join-Path $ReleasePackageRoot "www\js\generatedMenuEntries.js"
        Join-Path $ReleasePackageRoot "overlay\www\js\generatedMenuEntries.js"
    )
    $genHeaderPath = Join-Path $ReleasePackageRoot "www\theme\js\genHeader.js"
    $releaseInfoPath = Join-Path $ReleasePackageRoot "usrdata\at-stock-ui\JTOOLS_RELEASE.txt"

    foreach ($file in $htmlFiles) {
        Replace-InFile -Path $file.FullName -Pattern 'qtooley-v[^"\s]+' -Replacement ("qtooley-" + $token)
        Replace-InFile -Path $file.FullName -Pattern 'jtools-dark-v[^"\s]+' -Replacement ("jtools-dark-" + $token)
        Replace-InFile -Path $file.FullName -Pattern 'jtools-menu-v[^"\s]+' -Replacement ("jtools-menu-" + $token)
        Replace-InFile -Path $file.FullName -Pattern 'jtools-genheader-v[^"\s]+' -Replacement ("jtools-genheader-" + $token)
        Replace-InFile -Path $file.FullName -Pattern 'jtools-general-css-v[^"\s]+' -Replacement ("jtools-general-css-" + $token)
        Replace-InFile -Path $file.FullName -Pattern 'jtools-general-core-v[^"\s]+' -Replacement ("jtools-general-core-" + $token)
        Replace-InFile -Path $file.FullName -Pattern 'jtools-general-v[^"\s]+' -Replacement ("jtools-general-" + $token)
    }

    foreach ($filePath in $pageUrlFiles) {
        Replace-InFile -Path $filePath -Pattern '/general_dashboard\.html\?v=[^"]+' -Replacement ("/general_dashboard.html?v=" + $token)
        Replace-InFile -Path $filePath -Pattern '/at_terminal\.html\?v=[^"]+' -Replacement ("/at_terminal.html?v=" + $token)
        Replace-InFile -Path $filePath -Pattern '/ookla_speedtest\.html\?v=[^"]+' -Replacement ("/ookla_speedtest.html?v=" + $token)
        Replace-InFile -Path $filePath -Pattern '/tailscale\.html\?v=[^"]+' -Replacement ("/tailscale.html?v=" + $token)
    }

    Replace-InFile -Path $genHeaderPath -Pattern 'jtools-dark-v[^"\s]+' -Replacement ("jtools-dark-" + $token)

    if (Test-Path $releaseInfoPath) {
        $lines = Get-Content $releaseInfoPath
        $updatedLines = foreach ($line in $lines) {
            if ($line -match '^Jtools asset tokens$') {
                $line
                " - release-cache-token=$token"
            } else {
                $line
            }
        }
        [System.IO.File]::WriteAllLines($releaseInfoPath, $updatedLines, (New-Object System.Text.UTF8Encoding($false)))
    }
}

$version = Get-VersionText -RepoPath $RepoRoot -Requested $ReleaseVersion
$stageRoot = Join-Path $env:TEMP ("stock-ui-at-release-" + (Get-Date -Format "yyyyMMdd_HHmmss"))
$releaseRoot = Join-Path $stageRoot ("stock-ui-at-installer-" + $version)
$packageRoot = Join-Path $RepoRoot "router-files\stock-ui-at"
$scriptsRoot = Join-Path $RepoRoot "scripts"

try {
    New-Item -ItemType Directory -Force -Path $releaseRoot | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $releaseRoot "router-files") | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $releaseRoot "scripts") | Out-Null

    Copy-Item -Recurse -Force $packageRoot (Join-Path $releaseRoot "router-files\stock-ui-at")
    $releasePackageRoot = Join-Path $releaseRoot "router-files\stock-ui-at"
    $releaseStockSnapshots = Join-Path $releasePackageRoot "stock-snapshots"
    if (Test-Path $releaseStockSnapshots) {
        Remove-Item -Recurse -Force $releaseStockSnapshots
    }
    Ensure-OoklaBundle -ReleasePackageRoot $releasePackageRoot -RequestedSource $OoklaBundleSource -DownloadUrl $OoklaBundleUrl
    Apply-ReleaseCacheTokens -ReleasePackageRoot $releasePackageRoot -Version $version
    Copy-Item -Force (Join-Path $scriptsRoot "stock_ui_at_release_common.ps1") (Join-Path $releaseRoot "scripts\stock_ui_at_release_common.ps1")
    Copy-Item -Force (Join-Path $scriptsRoot "install_stock_ui_at.ps1") (Join-Path $releaseRoot "install_stock_ui_at.ps1")
    Copy-Item -Force (Join-Path $scriptsRoot "uninstall_stock_ui_at.ps1") (Join-Path $releaseRoot "uninstall_stock_ui_at.ps1")
    Copy-Item -Force (Join-Path $packageRoot "RELEASE_INSTALL.md") (Join-Path $releaseRoot "README.txt")

    @(
        "release_version=$version"
        "built_at=$(Get-Date -Format s)"
        "repo_root=$RepoRoot"
    ) | Set-Content -Path (Join-Path $releaseRoot "RELEASE_INFO.txt")

    New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null
    $zipPath = Join-Path $OutputRoot ("stock-ui-at-installer-" + $version + ".zip")
    if (Test-Path $zipPath) {
        Remove-Item -Force $zipPath
    }

    Compress-Archive -Path (Join-Path $releaseRoot "*") -DestinationPath $zipPath

    Write-Output "Release ZIP created: $zipPath"
    Write-Output "Stage folder: $releaseRoot"
} finally {
    if (Test-Path $stageRoot) {
        Remove-Item -Recurse -Force $stageRoot
    }
}
