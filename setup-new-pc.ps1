param(
  [switch]$CheckOnly
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$expectedRemote = 'https://github.com/lsjhipeach-lang/-.git'
$repositoryRoot = $PSScriptRoot

function Require-Command {
  param([Parameter(Mandatory = $true)][string]$Name)

  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $command) {
    throw "Required command is not installed: $Name"
  }

  return $command.Source
}

Write-Host 'Checking the Sapporo trip app development environment...'
Require-Command -Name 'git' | Out-Null
Require-Command -Name 'python' | Out-Null

if (-not (Test-Path -LiteralPath (Join-Path $repositoryRoot '.git'))) {
  throw 'Run this script from a Git clone of the repository, not from a ZIP download.'
}

Set-Location -LiteralPath $repositoryRoot

$remote = (git remote get-url origin 2>$null).Trim()
if ($LASTEXITCODE -ne 0 -or $remote -ne $expectedRemote) {
  throw "Unexpected origin remote. Expected: $expectedRemote / Actual: $remote"
}

$gitName = (git config --global --get user.name 2>$null)
$gitEmail = (git config --global --get user.email 2>$null)

if ($CheckOnly) {
  if ([string]::IsNullOrWhiteSpace($gitName)) {
    Write-Warning 'Git user.name is not configured.'
  }
  if ([string]::IsNullOrWhiteSpace($gitEmail)) {
    Write-Warning 'Git user.email is not configured.'
  }
} else {
  if ([string]::IsNullOrWhiteSpace($gitName)) {
    $gitName = Read-Host 'Enter your GitHub display name'
    if ([string]::IsNullOrWhiteSpace($gitName)) {
      throw 'Git user.name cannot be empty.'
    }
    git config --global user.name $gitName
  }

  if ([string]::IsNullOrWhiteSpace($gitEmail)) {
    $gitEmail = Read-Host 'Enter the email registered with GitHub (or your GitHub noreply email)'
    if ([string]::IsNullOrWhiteSpace($gitEmail)) {
      throw 'Git user.email cannot be empty.'
    }
    git config --global user.email $gitEmail
  }
}

$changes = @(git status --porcelain)
if ($changes.Count -gt 0) {
  Write-Warning 'Local changes exist. They were not deleted or overwritten.'
  git status --short --branch
  if (-not $CheckOnly) {
    throw 'Commit or preserve the local changes before pulling.'
  }
} elseif (-not $CheckOnly) {
  git pull --ff-only
  if ($LASTEXITCODE -ne 0) {
    throw 'git pull failed. Check GitHub sign-in and network access.'
  }
}

Write-Host ''
Write-Host 'Environment check complete.'
Write-Host "Repository: $repositoryRoot"
Write-Host "Remote:     $remote"
Write-Host "Git:        $(git --version)"
Write-Host "Python:     $(python --version 2>&1)"
git status --short --branch

if (-not $CheckOnly) {
  Write-Host ''
  Write-Host 'Next: open this folder in VS Code, then ask Codex to edit, test, commit, and push.'
}
