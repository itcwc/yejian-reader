$ErrorActionPreference = 'Stop'

$repository = 'itcwc/yejian-reader'
$signingDirectory = Join-Path $PSScriptRoot '../.env.android-signing'
$keystore = Join-Path $signingDirectory 'yejian-release.p12'
$passwordFile = Join-Path $signingDirectory 'password.dpapi'

gh auth status --hostname github.com
if ($LASTEXITCODE -ne 0) { throw 'Sign in to GitHub CLI with repository administration access first.' }

$keystoreBase64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($keystore))
$password = Get-Content -LiteralPath $passwordFile -Raw | ConvertTo-SecureString
try {
    $keystoreBase64 | gh secret set YEJIAN_ANDROID_KEYSTORE_BASE64 --repo $repository
    if ($LASTEXITCODE -ne 0) { throw 'Failed to save the Android keystore secret.' }

    [System.Net.NetworkCredential]::new('', $password).Password |
        gh secret set YEJIAN_ANDROID_KEYSTORE_PASSWORD --repo $repository
    if ($LASTEXITCODE -ne 0) { throw 'Failed to save the Android keystore password secret.' }
} finally {
    $password.Dispose()
    Remove-Variable keystoreBase64
}
