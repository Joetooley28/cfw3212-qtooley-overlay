# Copyright (C) 2026 Joe Tooley
# SPDX-License-Identifier: GPL-2.0-or-later
# See repository root LICENSE for full license text.
<#
.SYNOPSIS
Builds and publishes the public GitHub release from the safe main worktree.

.DESCRIPTION
This helper is the safest one-command path after `working-branch` is committed
and verified. It:
1. pushes `working-branch`
2. promotes the tracked public payload into `repo-public-main`
3. builds the release ZIP from `repo-public-main`
4. composes the full GitHub release page body from the stable template plus the
   bottom release-notes block
5. commits/pushes `main`
6. creates or updates the GitHub release

Important rule:
- do NOT pass `release-notes-v*.txt` directly to `gh --notes-file`
- that text file is only the changing bottom changelog block
- this script always renders the full release body first and sends the composed
  `github-release-body-v*.md` file to GitHub

If `release-notes-v*.txt` is missing, the script will generate it from the top
matching `## <version>` section in `CHANGELOG.md`.
#>

param(
    [string]$SourceRepo = "C:\at_terminal\repo-public",
    [string]$DestinationRepo = "C:\at_terminal\repo-public-main",
    [string]$RepoSlug = "Joetooley28/cfw3212-qtooley-overlay",
    [string]$ReleaseVersion = "",
    [string]$TemplatePath = "",
    [string]$ReleaseNotesPath = "",
    [string]$BodyOutputPath = "",
    [string]$OutputRoot = "",
    [string]$CommitMessage = "",
    [switch]$SkipPushWorking,
    [switch]$SkipPushMain,
    [switch]$SkipGitHubRelease
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
if ($PSVersionTable.PSVersion.Major -ge 7) {
    $PSNativeCommandUseErrorActionPreference = $false
}

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message"
}

function Invoke-Git {
    param(
        [string]$RepoRoot,
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$Arguments
    )

    $output = & git -C $RepoRoot @Arguments 2>&1
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        if ($output) {
            throw ($output -join [Environment]::NewLine)
        }
        throw "git failed in $RepoRoot with arguments: $($Arguments -join ' ')"
    }

    return $output
}

function Invoke-CommandChecked {
    param(
        [string]$CommandName,
        [string[]]$Arguments
    )

    $output = & $CommandName @Arguments 2>&1
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        if ($output) {
            throw ($output -join [Environment]::NewLine)
        }
        throw "$CommandName failed with arguments: $($Arguments -join ' ')"
    }

    return $output
}

function Get-StatusBranchLine {
    param(
        [string]$RepoRoot
    )

    $statusLines = @(Invoke-Git -RepoRoot $RepoRoot status --short --branch)
    foreach ($line in $statusLines) {
        $text = "$line".TrimEnd()
        if ($text.StartsWith("## ")) {
            return $text
        }
    }

    return ""
}

function Get-AheadCount {
    param(
        [string]$RepoRoot
    )

    $branchLine = Get-StatusBranchLine -RepoRoot $RepoRoot
    if (-not $branchLine) {
        return $null
    }

    $match = [regex]::Match($branchLine, '\[ahead (?<count>\d+)(, behind \d+)?\]')
    if (-not $match.Success) {
        return 0
    }

    return [int]$match.Groups["count"].Value
}

function Push-BranchIfNeeded {
    param(
        [string]$RepoRoot,
        [string]$BranchName
    )

    $aheadCount = Get-AheadCount -RepoRoot $RepoRoot
    if ($null -ne $aheadCount -and $aheadCount -le 0) {
        Write-Host "Branch '$BranchName' is already aligned with origin; skipping push."
        return
    }

    Invoke-Git -RepoRoot $RepoRoot push origin $BranchName | Out-Host
}

function Get-VersionText {
    param(
        [string]$RepoRoot,
        [string]$Requested
    )

    if ($Requested) {
        return $Requested.Trim()
    }

    $versionPath = Join-Path $RepoRoot "VERSION.txt"
    if (-not (Test-Path $versionPath)) {
        throw "VERSION.txt not found: $versionPath"
    }

    $version = (Get-Content $versionPath | Select-Object -First 1).Trim()
    if (-not $version) {
        throw "VERSION.txt is empty: $versionPath"
    }

    return $version
}

function Assert-PathExists {
    param(
        [string]$Path,
        [string]$Label
    )

    if (-not (Test-Path $Path)) {
        throw "$Label not found: $Path"
    }
}

function Assert-Branch {
    param(
        [string]$RepoRoot,
        [string]$ExpectedBranch
    )

    $branch = (Invoke-Git -RepoRoot $RepoRoot rev-parse --abbrev-ref HEAD | Select-Object -First 1).Trim()
    if ($branch -ne $ExpectedBranch) {
        throw "Expected branch '$ExpectedBranch' in $RepoRoot but found '$branch'."
    }
}

function Assert-CleanWorktree {
    param(
        [string]$RepoRoot,
        [string]$Label
    )

    $status = @(Invoke-Git -RepoRoot $RepoRoot status --porcelain)
    if ($status.Count -gt 0) {
        throw "$Label worktree is not clean:`n$($status -join [Environment]::NewLine)"
    }
}

function Get-ReleaseNotesBlock {
    param(
        [string]$NotesPath
    )

    if (-not (Test-Path $NotesPath)) {
        throw "Release notes file not found: $NotesPath"
    }

    $bulletLines = @(Get-Content $NotesPath | Where-Object { $_ -match '^\s*-\s+' } | ForEach-Object { $_.TrimEnd() })
    if ($bulletLines.Count -eq 0) {
        return "- Release notes were not found in bullet form. See the full changelog below."
    }

    return ($bulletLines -join [Environment]::NewLine)
}

function Get-TopChangelogSection {
    param(
        [string]$ChangelogPath,
        [string]$Version
    )

    if (-not (Test-Path $ChangelogPath)) {
        throw "CHANGELOG not found: $ChangelogPath"
    }

    $lines = Get-Content $ChangelogPath
    $header = "## $Version"
    $startIndex = -1
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i].Trim() -eq $header) {
            $startIndex = $i
            break
        }
    }

    if ($startIndex -lt 0) {
        throw "Could not find changelog section for $Version in $ChangelogPath"
    }

    $section = New-Object System.Collections.Generic.List[string]
    for ($i = $startIndex + 1; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        if ($line -match '^##\s+') {
            break
        }
        $section.Add($line)
    }

    return @($section.ToArray())
}

function Ensure-ReleaseNotesFile {
    param(
        [string]$NotesPath,
        [string]$ChangelogPath,
        [string]$Version
    )

    if (Test-Path $NotesPath) {
        return
    }

    $sectionLines = Get-TopChangelogSection -ChangelogPath $ChangelogPath -Version $Version
    if ($sectionLines.Count -eq 0) {
        throw "Changelog section for $Version was empty; cannot generate release notes file."
    }

    Write-Host "Release notes file missing; generating from CHANGELOG.md..."
    $content = @($Version, "") + $sectionLines
    Write-Utf8NoBom -Path $NotesPath -Content (($content -join [Environment]::NewLine).TrimEnd() + [Environment]::NewLine)
}

function Render-ReleaseBody {
    param(
        [string]$TemplateFile,
        [string]$Version,
        [string]$RepoSlugValue,
        [string]$ReleaseNotesBlock
    )

    if (-not (Test-Path $TemplateFile)) {
        throw "GitHub release body template not found: $TemplateFile"
    }

    $body = [System.IO.File]::ReadAllText($TemplateFile)
    $rawBaseUrl = "https://raw.githubusercontent.com/$RepoSlugValue/main"
    $changelogUrl = "https://github.com/$RepoSlugValue/blob/main/CHANGELOG.md"
    $replacements = @{
        "{{RELEASE_VERSION}}" = $Version
        "{{RAW_BASE_URL}}" = $rawBaseUrl
        "{{FULL_CHANGELOG_URL}}" = $changelogUrl
        "{{RELEASE_NOTES_BLOCK}}" = $ReleaseNotesBlock
    }

    foreach ($key in $replacements.Keys) {
        $body = $body.Replace($key, $replacements[$key])
    }

    return $body
}

function Write-Utf8NoBom {
    param(
        [string]$Path,
        [string]$Content
    )

    $parent = Split-Path -Parent $Path
    if ($parent -and -not (Test-Path $parent)) {
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
    }

    [System.IO.File]::WriteAllText($Path, $Content, (New-Object System.Text.UTF8Encoding($false)))
}

function Test-ReleaseExists {
    param(
        [string]$RepoSlugValue,
        [string]$Tag
    )

    $releaseListJson = Invoke-CommandChecked -CommandName "gh" -Arguments @(
        "release", "list",
        "-R", $RepoSlugValue,
        "--limit", "200",
        "--json", "tagName"
    )

    $releases = @(($releaseListJson -join [Environment]::NewLine) | ConvertFrom-Json)
    return (@($releases | Where-Object { $_.tagName -eq $Tag }).Count -gt 0)
}

Assert-Branch -RepoRoot $SourceRepo -ExpectedBranch "working-branch"
Assert-Branch -RepoRoot $DestinationRepo -ExpectedBranch "main"
Assert-CleanWorktree -RepoRoot $SourceRepo -Label "Source repo"
Assert-CleanWorktree -RepoRoot $DestinationRepo -Label "Destination repo"

$version = Get-VersionText -RepoRoot $SourceRepo -Requested $ReleaseVersion
if (-not $TemplatePath) {
    $TemplatePath = Join-Path $SourceRepo "docs\github-release-body-template.md"
}
if (-not $OutputRoot) {
    $OutputRoot = Join-Path $DestinationRepo "dist"
}
if (-not $ReleaseNotesPath) {
    $ReleaseNotesPath = Join-Path $OutputRoot ("release-notes-" + $version + ".txt")
}
if (-not $BodyOutputPath) {
    $BodyOutputPath = Join-Path $OutputRoot ("github-release-body-" + $version + ".md")
}
if (-not $CommitMessage) {
    $CommitMessage = "Release $version"
}

$promoteScript = Join-Path $SourceRepo "scripts\promote_to_main.ps1"
$buildScript = Join-Path $SourceRepo "scripts\build_stock_ui_at_release.ps1"
$zipPath = Join-Path $OutputRoot ("stock-ui-at-installer-" + $version + ".zip")
$sourceChangelogPath = Join-Path $SourceRepo "CHANGELOG.md"

Assert-PathExists -Path $TemplatePath -Label "GitHub release body template"
Assert-PathExists -Path $promoteScript -Label "Promotion helper"
Assert-PathExists -Path $buildScript -Label "Release build helper"
Assert-PathExists -Path $sourceChangelogPath -Label "Source changelog"

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw "GitHub CLI 'gh' is not available in PATH."
}

if (-not $SkipPushWorking) {
    Write-Step "Pushing working-branch"
    Push-BranchIfNeeded -RepoRoot $SourceRepo -BranchName "working-branch"
}

Write-Step "Promoting public release files into main"
Invoke-CommandChecked -CommandName "powershell" -Arguments @(
    "-ExecutionPolicy", "Bypass",
    "-File", $promoteScript,
    "-SourceRepo", $SourceRepo,
    "-DestinationRepo", $DestinationRepo,
    "-Apply"
) | Out-Host

Write-Step "Building release ZIP from main"
Invoke-CommandChecked -CommandName "powershell" -Arguments @(
    "-ExecutionPolicy", "Bypass",
    "-File", $buildScript,
    "-RepoRoot", $DestinationRepo,
    "-ReleaseVersion", $version,
    "-OutputRoot", $OutputRoot
) | Out-Host

Assert-PathExists -Path $zipPath -Label "Release ZIP"

Write-Step "Preparing release notes and composed GitHub release body"
Ensure-ReleaseNotesFile -NotesPath $ReleaseNotesPath -ChangelogPath $sourceChangelogPath -Version $version
$releaseNotesBlock = Get-ReleaseNotesBlock -NotesPath $ReleaseNotesPath
$releaseBody = Render-ReleaseBody -TemplateFile $TemplatePath -Version $version -RepoSlugValue $RepoSlug -ReleaseNotesBlock $releaseNotesBlock
Write-Utf8NoBom -Path $BodyOutputPath -Content $releaseBody
Write-Host "GitHub release body written to: $BodyOutputPath"

$destinationStatus = @(Invoke-Git -RepoRoot $DestinationRepo status --porcelain)
if ($destinationStatus.Count -gt 0) {
    Write-Step "Committing main release state"
    Invoke-Git -RepoRoot $DestinationRepo -c core.safecrlf=false add README.md CHANGELOG.md VERSION.txt LICENSE LICENSE-docs.md NOTICE.md docs scripts router-files/stock-ui-at | Out-Null
    $postAddStatus = @(Invoke-Git -RepoRoot $DestinationRepo status --porcelain)
    if ($postAddStatus.Count -gt 0) {
        Invoke-Git -RepoRoot $DestinationRepo commit -m $CommitMessage | Out-Host
    }
}

if (-not $SkipPushMain) {
    Write-Step "Pushing main"
    Push-BranchIfNeeded -RepoRoot $DestinationRepo -BranchName "main"
}

if (-not $SkipGitHubRelease) {
    $target = "main"
    if (Test-ReleaseExists -RepoSlugValue $RepoSlug -Tag $version) {
        Write-Step "Updating existing GitHub release"
        Invoke-CommandChecked -CommandName "gh" -Arguments @(
            "release", "upload", $version, $zipPath,
            "-R", $RepoSlug,
            "--clobber"
        ) | Out-Host
        Invoke-CommandChecked -CommandName "gh" -Arguments @(
            "release", "edit", $version,
            "-R", $RepoSlug,
            "--title", $version,
            "--notes-file", $BodyOutputPath
        ) | Out-Host
    } else {
        Write-Step "Creating new GitHub release"
        Invoke-CommandChecked -CommandName "gh" -Arguments @(
            "release", "create", $version, $zipPath,
            "-R", $RepoSlug,
            "--target", $target,
            "--title", $version,
            "--notes-file", $BodyOutputPath,
            "--latest"
        ) | Out-Host
    }
}

Write-Host ""
Write-Host "Release workflow complete."
Write-Host "Version: $version"
Write-Host "ZIP: $zipPath"
Write-Host "Release body: $BodyOutputPath"
