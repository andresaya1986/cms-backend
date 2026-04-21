$ErrorActionPreference = "Continue"

Write-Host "TEST: Avatar Upload Endpoint"

# 1. Login
Write-Host "Step 1: Login" -ForegroundColor Cyan
$loginBody = @{
    email = "avatar@test.com"
    password = "Avatar@12345"
} | ConvertTo-Json

$loginResp = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/login" `
    -Method Post -ContentType "application/json" -Body $loginBody

$token = $loginResp.accessToken
Write-Host "Login OK - Token: $($token.Substring(0, 20))..." -ForegroundColor Green

# 2. Create test image
Write-Host "Step 2: Create test image" -ForegroundColor Cyan
$pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw0pVKAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAADdgAAA3YBfdqDSQAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAD8SURBVHic7cExDQAwCMAwwL+8hMAGLGABG7CACTbABhYwwAL+kUgIkTD2PTa9N71X1TVJST1ZlpVlWZZlWZZlWZZlWZZlWZZlWZZlWZZlWZZlWZZlWZZlWZZlWZZlWZZlWZZlWZZlWZZlWZZlWZZlWZZlWf4/BgA9c3RlcwoAAAAASUVORK5CYII="
$pngBytes = [Convert]::FromBase64String($pngBase64)
$imagePath = "C:\Users\jaime\Downloads\cms-backend\test_avatar.png"
[System.IO.File]::WriteAllBytes($imagePath, $pngBytes)
Write-Host "Image created OK" -ForegroundColor Green

# 3. Upload avatar
Write-Host "Step 3: Upload avatar" -ForegroundColor Cyan

$fileStream = [System.IO.File]::OpenRead($imagePath)

$headers = @{
    Authorization = "Bearer $token"
}

$form = @{
    avatar = $fileStream
}

$response = Invoke-WebRequest -Uri "http://localhost:3000/api/v1/auth/profile/avatar" `
    -Method Post `
    -Headers $headers `
    -Form $form

$fileStream.Close()

Write-Host "Upload OK (HTTP $($response.StatusCode))" -ForegroundColor Green

$jsonResp = $response.Content | ConvertFrom-Json
Write-Host "`nResponse:" -ForegroundColor Cyan
$jsonResp | ConvertTo-Json -Depth 5
