[CmdletBinding()]
param(
    [string]$OutputPath = ''
)

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if ([string]::IsNullOrWhiteSpace($OutputPath)) { $OutputPath = Join-Path (Split-Path $root -Parent) 'doq-project-transfer.zip' }
$output = [IO.Path]::GetFullPath($OutputPath)
$temp = Join-Path ([IO.Path]::GetTempPath()) ('doq-transfer-' + [guid]::NewGuid().ToString('N'))

New-Item -ItemType Directory -Path $temp -Force | Out-Null
try {
    Get-ChildItem -LiteralPath $root -Force | Where-Object { $_.Name -notin @('.env', '.env.development', '.env.production', 'node_modules', '.git', 'tmp', 'verification', 'backups', 'public\upload') } | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $temp $_.Name) -Recurse -Force
    }
    Get-ChildItem -LiteralPath $temp -Recurse -Force -File | Where-Object {
        $_.Name -in @('.env', '.env.development', '.env.production') -or $_.FullName -match '\\(node_modules|\.git|tmp|verification|backups)(\\|$)'
    } | Remove-Item -Force
    $uploadCopy = Join-Path $temp 'public\upload'
    if (Test-Path -LiteralPath $uploadCopy) { Remove-Item -LiteralPath $uploadCopy -Recurse -Force }
    $outputParent = Split-Path $output -Parent
    New-Item -ItemType Directory -Path $outputParent -Force | Out-Null
    if (Test-Path -LiteralPath $output) { Remove-Item -LiteralPath $output -Force }
    Compress-Archive -Path (Join-Path $temp '*') -DestinationPath $output -CompressionLevel Optimal
    $entries = Get-ChildItem -LiteralPath $temp -Recurse -Force -File
    if (-not ($entries.Name -contains 'package-lock.json')) { throw 'transfer_missing_package_lock' }
    if ($entries.FullName -match '\\\.env$|\\\.env\.development$|\\\.env\.production$|\\node_modules(\\|$)|\\\.git(\\|$)') { throw 'transfer_contains_private_runtime_data' }
    Write-Output $output
}
finally {
    if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp -Recurse -Force }
}
