Get-Content .env.example | ForEach-Object {
    if ($_ -match '^([^#=]+)=') {
        $varName = $Matches[1].Trim()
        if ($varName) {
            Remove-Item "env:$varName" -ErrorAction SilentlyContinue
            Write-Host "Unsetting $varName"
        }
    }
}
