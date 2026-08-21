$pythonCandidates = @(
    "$PSScriptRoot\.venv\Scripts\python.exe",
    "C:\Program Files\AnsysEM\Ansys Student\v242\Win64\common\commonfiles\CPython\3_10\winx64\python\python.exe",
    "python"
)

$python = $pythonCandidates | Where-Object { Test-Path $_ -ErrorAction SilentlyContinue } | Select-Object -First 1

if (-not $python) {
    $python = "python"
}

if (-not (Test-Path "$PSScriptRoot\.venv\Scripts\python.exe")) {
    & $python -m venv "$PSScriptRoot\.venv"
}

& "$PSScriptRoot\.venv\Scripts\python.exe" -m pip install --upgrade pip
& "$PSScriptRoot\.venv\Scripts\python.exe" -m pip install -r "$PSScriptRoot\requirements.txt"

Write-Host "AI agent environment is ready."
