# update-sw-version.ps1
$swPath = "C:\Users\samwd\source\repos\PersonalWebsitePWA\PersonalWebsite\wwwroot\service-worker.published.js"
$versionPattern = "// Version updated at "
$versionStr = $versionPattern + "$(Get-Date -Format s)`r`n"

# Read the content of the file
$swContent = Get-Content $swPath -Raw

# Remove existing version line if present
$swContent = $swContent -replace "^$versionPattern.*`r`n", ''

# Prepend the new version string
$swContent = $versionStr + $swContent

# Write the updated content back to the file
Set-Content $swPath -Value $swContent
