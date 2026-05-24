# pythonTest

This folder contains a local Python virtual environment and a document converter.

## Activate the environment

PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

If script execution is blocked, run the converter through the venv Python directly:

```powershell
.\.venv\Scripts\python.exe .\doc_to_md.py .\input.docx -o .\output
```

## Convert a document

```powershell
.\.venv\Scripts\python.exe .\doc_to_md.py .\your-file.docx -o .\output
```

## Start the UI

Double-click:

```text
start_ui.bat
```

Or run:

```powershell
.\.venv\Scripts\python.exe .\doc_to_md_ui.py
```

The converter creates:

- `output/<document-name>.md`
- `output/<document-name>_images/`

For legacy `.doc` files, the script first tries LibreOffice, then Microsoft Word
COM automation. Install one of them if `.doc` conversion fails.
