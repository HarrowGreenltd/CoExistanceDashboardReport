param([Parameter(Mandatory=$true)][string]$WorkbookPath,[string]$OutputFolder=".",[int]$PartSizeMB=20)
$ErrorActionPreference='Stop';$source=Get-Item -LiteralPath $WorkbookPath
if($PartSizeMB -lt 1 -or $PartSizeMB -gt 24){throw 'PartSizeMB must be between 1 and 24.'}
New-Item -ItemType Directory -Path $OutputFolder -Force|Out-Null;$partSize=[int64]$PartSizeMB*1MB;$input=[IO.File]::OpenRead($source.FullName);$names=[Collections.Generic.List[string]]::new()
try{$buffer=New-Object byte[] 1048576;$i=0;while($input.Position -lt $input.Length){$i++;$name='coexistence-data.part{0:D3}' -f $i;$names.Add($name);$out=[IO.File]::Create((Join-Path $OutputFolder $name));try{$left=$partSize;while($left -gt 0 -and $input.Position -lt $input.Length){$read=$input.Read($buffer,0,[Math]::Min($buffer.Length,$left));if($read -le 0){break};$out.Write($buffer,0,$read);$left-=$read}}finally{$out.Dispose()}}}finally{$input.Dispose()}
[ordered]@{schema=1;fileName='coexistence-data.xlsx';bytes=$source.Length;parts=$names}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $OutputFolder 'coexistence-data.manifest.json') -Encoding utf8
Write-Host "Created $($names.Count) parts and a manifest."
