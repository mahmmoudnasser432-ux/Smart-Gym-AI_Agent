$venvPython = "$PSScriptRoot\.venv\Scripts\python.exe"
$ansysPython = "C:\Program Files\AnsysEM\Ansys Student\v242\Win64\common\commonfiles\CPython\3_10\winx64\python\python.exe"

if (Test-Path $venvPython) {
    $python = $venvPython
} elseif (Test-Path $ansysPython) {
    $python = $ansysPython
} else {
    $python = "python"
}

Set-Location $PSScriptRoot
& $python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
