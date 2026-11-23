$ErrorActionPreference='Stop'
node --test "$PSScriptRoot/step3_20261123.test.cjs"
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
