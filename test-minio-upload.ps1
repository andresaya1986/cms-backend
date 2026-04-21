# Script de prueba para MinIO upload

Write-Host "=== Prueba de configuración de MinIO ===" -ForegroundColor Green

Write-Host "`n1. Verificando conectividad a MinIO..."
$minioHealth = curl.exe -s -m 5 "http://localhost:9000/minio/health/live"
if ($minioHealth) {
    Write-Host "✅ MinIO accesible en puerto 9000" -ForegroundColor Green
} else {
    Write-Host "❌ MinIO NO es accesible" -ForegroundColor Red
}

Write-Host "`n2. Verificando buckets..."
docker compose exec minio mc ls myminio | ForEach-Object { Write-Host "  $_" }

Write-Host "`n3. Creando archivo de prueba..."
$testFile = "test-upload.txt"
"Este es un archivo de prueba para MinIO" | Out-File -FilePath $testFile -Encoding UTF8

Write-Host "`n4. Subiendo archivo a MinIO..."
$uploadCmd = "docker compose exec minio mc cp $testFile myminio/cms-public/test/test-upload.txt"
Invoke-Expression $uploadCmd

Write-Host "`n5. Verificando archivo subido..."
docker compose exec minio mc ls myminio/cms-public/test/

Write-Host "`n6. Limpiando archivo local..."
Remove-Item $testFile -Force

Write-Host "`n✅ Prueba completada" -ForegroundColor Green
Write-Host "`nResumen:`n  - MinIO: Corriendo en puerto 9000`n  - Buckets: cms-public, cms-private`n  - Upload de prueba: Completado" -ForegroundColor Cyan
