# ==============================================================================
# AOTUC-TRANSPORT v2.0 — Automated PostgreSQL PostGIS Database Backup Script
# Platform: Windows PowerShell
# ==============================================================================

param(
    [string]$BackupDir = "C:\Users\Derrick\OneDrive\Desktop\transport\backups",
    [string]$ContainerName = "aotuc_postgres_postgis",
    [string]$DbUser = "aotuc_admin",
    [string]$DbName = "aotuc_transport"
)

if (!(Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$Timestamp = (Get-Date).ToString("yyyyMMdd_HHmmss")
$BackupFile = Join-Path $BackupDir "aotuc_backup_${Timestamp}.sql.gz"

Write-Host "=================================================================="
Write-Host " [AOTUC] Sauvegarde Automatisée de la Base de Données PostGIS"
Write-Host " Date : $(Get-Date -Format 'dd/MM/yyyy HH:mm:ss')"
Write-Host " Destination : $BackupFile"
Write-Host "=================================================================="

try {
    # If Docker container is running, backup via docker exec
    $dockerCheck = docker ps --filter "name=$ContainerName" --format "{{.Names}}" 2>$null
    if ($dockerCheck -eq $ContainerName) {
        Write-Host "-> Sauvegarde via conteneur Docker ($ContainerName)..."
        docker exec -t $ContainerName pg_dump -U $DbUser $DbName | gzip > $BackupFile
    } else {
        # Fallback to local PostgreSQL 18
        $pgDumpPath = "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe"
        if (Test-Path $pgDumpPath) {
            Write-Host "-> Sauvegarde via instance locale ($pgDumpPath)..."
            & $pgDumpPath -U postgres -d $DbName -F c -b -v -f $BackupFile
        } else {
            throw "Aucune instance PostgreSQL active (Docker ou locale) détectée."
        }
    }

    Write-Host "✓ Sauvegarde réussie avec succès !" -ForegroundColor Green
    Write-Host "Taille : $((Get-Item $BackupFile).Length / 1MB) Mo"
} catch {
    Write-Error "Échec de la sauvegarde : $_"
    exit 1
}
