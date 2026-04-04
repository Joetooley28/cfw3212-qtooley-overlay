param(
    [string]$RepoRoot = "C:\at_terminal\repo-public",
    [string]$ReleaseVersion = "",
    [string]$OutputRoot = "C:\at_terminal\repo-public\dist"
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

$version = Get-VersionText -RepoPath $RepoRoot -Requested $ReleaseVersion
$stageRoot = Join-Path $env:TEMP ("stock-ui-at-release-" + (Get-Date -Format "yyyyMMdd_HHmmss"))
$releaseRoot = Join-Path $stageRoot ("stock-ui-at-installer-" + $version)
$routerStageRoot = Join-Path $stageRoot "router-package"
$routerPackageName = "stock-ui-at-router-package-" + $version + ".tar.gz"
$routerPackageLatestName = "stock-ui-at-router-package-latest.tar.gz"
$routerShaName = "stock-ui-at-router-package-" + $version + ".sha256"
$routerShaLatestName = "stock-ui-at-router-package-latest.sha256"
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

    New-Item -ItemType Directory -Force -Path $routerStageRoot | Out-Null
    Copy-Item -Recurse -Force $packageRoot (Join-Path $routerStageRoot "stock-ui-at")

    $routerPackagePath = Join-Path $OutputRoot $routerPackageName
    $routerPackageLatestPath = Join-Path $OutputRoot $routerPackageLatestName
    $routerShaPath = Join-Path $OutputRoot $routerShaName
    $routerShaLatestPath = Join-Path $OutputRoot $routerShaLatestName

    @($routerPackagePath, $routerPackageLatestPath, $routerShaPath, $routerShaLatestPath) | ForEach-Object {
        if (Test-Path $_) {
            Remove-Item -Force $_
        }
    }

    & tar -czf $routerPackagePath -C $routerStageRoot "stock-ui-at"
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create router package tarball."
    }

    Copy-Item -Force $routerPackagePath $routerPackageLatestPath

    $routerHash = (Get-FileHash -Algorithm SHA256 $routerPackagePath).Hash.ToLowerInvariant()
    Set-Content -Path $routerShaPath -Value ("{0}  {1}" -f $routerHash, (Split-Path $routerPackagePath -Leaf))
    Set-Content -Path $routerShaLatestPath -Value ("{0}  {1}" -f $routerHash, (Split-Path $routerPackageLatestPath -Leaf))

    Write-Output "Release ZIP created: $zipPath"
    Write-Output "Router package created: $routerPackagePath"
    Write-Output "Router package latest alias: $routerPackageLatestPath"
    Write-Output "Stage folder: $releaseRoot"
} finally {
    if (Test-Path $stageRoot) {
        Remove-Item -Recurse -Force $stageRoot
    }
}
