# link-downloader 

A feature-rich web app that takes your URLs and converts them to platform-friendly redirect files. Supports customized QR code generation and URL lists for batch workflows.

This app supports:
- **Single mode**: generate one link file from one URL
- **Batch mode**: paste/import many URLs and download a ZIP containing generated link files, optional exports, and optional QR codes

## Live site (GitHub Pages)

[The app is available here](https://masieono.github.io/link-downloader/)

## Features

### Output formats
- **Redirect HTML** (`.html`)
- **Windows Internet Shortcut** (`.url`)
- **macOS webloc** (`.webloc`)

### URL handling modes
- Preserve full URL
- Strip tracking parameters
- Strip all query parameters

### Batch tools
- Deduping (optional + configurable strength)
- ZIP download containing generated link files
- Optional `export.csv` and `export.json`
- Optional QR codes in ZIP (`qr/*.png` and/or `qr/*.svg`)
- Download a standardized “Batch File” JSON for re-importing later
- Import supported formats:
  - `.csv` (URL column; delimiter auto-detected)
  - `.json` (batch/export/url list)
  - `.txt` (one URL per line)
  - `.html` bookmarks export / redirect link file (where supported)

## Privacy / Security
This app runs entirely in your browser. It does **not** send URLs anywhere.
All processing happens locally.
