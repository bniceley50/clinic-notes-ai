# pre-write

- Every source or config file write must use UTF-8 without BOM.
- Preferred PowerShell pattern:

```powershell
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText($path, $content, $utf8NoBom)
```

- Refuse writes that use `Set-Content` or `Out-File` without explicit no-BOM-safe encoding control.
- If a file was previously corrupted by encoding, re-write the full file with the UTF-8 NoBOM pattern before continuing.