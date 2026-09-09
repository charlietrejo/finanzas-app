# Genera los íconos de marca de Finanzas (violeta #6161FF + monograma "N").
# Requiere Windows + System.Drawing (no funciona en macOS/Linux). Es un script de
# un solo uso para regenerar los íconos si la marca cambia; no corre en CI.
#
# Uso: pwsh ./scripts/generate-icons.ps1

Add-Type -AssemblyName System.Drawing

$brandColor = [System.Drawing.Color]::FromArgb(255, 0x61, 0x61, 0xFF)
$white = [System.Drawing.Color]::White

function New-MonogramIcon {
    param(
        [int]$Size,
        [string]$OutPath,
        [double]$SafeZoneRatio = 1.0  # 1.0 = sin padding extra; <1 deja margen (maskable)
    )

    $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    $g.Clear($brandColor)

    $fontSize = [float]($Size * 0.58 * $SafeZoneRatio)
    $font = New-Object System.Drawing.Font("Arial", $fontSize, [System.Drawing.FontStyle]::Bold)
    $brush = New-Object System.Drawing.SolidBrush($white)

    $text = "N"
    $textSize = $g.MeasureString($text, $font)
    $x = ($Size - $textSize.Width) / 2
    $y = ($Size - $textSize.Height) / 2 - ($Size * 0.02)

    $g.DrawString($text, $font, $brush, $x, $y)

    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $g.Dispose()
    $bmp.Dispose()
    $font.Dispose()
    $brush.Dispose()
}

function New-Favicon {
    # Construye el .ico a mano incrustando PNGs (formato soportado desde Vista/
    # todos los navegadores modernos) en vez de Bitmap.GetHicon(), que pasa por
    # la API legacy de íconos de Windows (máscara 1-bit) y termina perdiendo el
    # color de fondo.
    param([string]$OutPath, [int[]]$Sizes = @(16, 32, 48))

    $pngBytesList = @()
    foreach ($s in $Sizes) {
        $tmp = [System.IO.Path]::GetTempFileName() + ".png"
        New-MonogramIcon -Size $s -OutPath $tmp
        $pngBytesList += , ([System.IO.File]::ReadAllBytes($tmp))
        Remove-Item $tmp -ErrorAction SilentlyContinue
    }

    $ms = New-Object System.IO.MemoryStream
    $bw = New-Object System.IO.BinaryWriter($ms)

    # ICONDIR: reserved(2)=0, type(2)=1, count(2)
    $bw.Write([uint16]0)
    $bw.Write([uint16]1)
    $bw.Write([uint16]$Sizes.Count)

    $headerSize = 6 + (16 * $Sizes.Count)
    $offset = $headerSize

    for ($i = 0; $i -lt $Sizes.Count; $i++) {
        $size = $Sizes[$i]
        $pngBytes = $pngBytesList[$i]
        $dim = if ($size -ge 256) { 0 } else { $size } # 0 significa 256px

        $bw.Write([byte]$dim)       # width
        $bw.Write([byte]$dim)       # height
        $bw.Write([byte]0)          # color palette
        $bw.Write([byte]0)          # reserved
        $bw.Write([uint16]1)        # color planes
        $bw.Write([uint16]32)       # bits per pixel
        $bw.Write([uint32]$pngBytes.Length)
        $bw.Write([uint32]$offset)

        $offset += $pngBytes.Length
    }

    foreach ($pngBytes in $pngBytesList) {
        $bw.Write($pngBytes)
    }

    $bw.Flush()
    [System.IO.File]::WriteAllBytes($OutPath, $ms.ToArray())
    $bw.Dispose()
    $ms.Dispose()
}

$root = Split-Path -Parent $PSScriptRoot

New-MonogramIcon -Size 512 -OutPath (Join-Path $root "src/app/icon.png")
New-MonogramIcon -Size 180 -OutPath (Join-Path $root "src/app/apple-icon.png")
# Copia en public/ con nombre estable para que el manifest la referencie por
# URL fija (la convención src/app/icon.png de Next no garantiza esa ruta).
Copy-Item (Join-Path $root "src/app/icon.png") (Join-Path $root "public/icon.png") -Force
New-MonogramIcon -Size 512 -OutPath (Join-Path $root "public/icon-maskable.png") -SafeZoneRatio 0.7
New-Favicon -OutPath (Join-Path $root "src/app/favicon.ico")

Write-Output "Iconos generados: src/app/icon.png, src/app/apple-icon.png, public/icon.png, public/icon-maskable.png, src/app/favicon.ico"
