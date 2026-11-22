#!/usr/bin/env bash
# Downloads the policy PDFs listed in urls.txt to pdfs/. Run locally:  bash download.sh
cd "$(dirname "$0")"; mkdir -p pdfs
grep -v '^\s*#' urls.txt | grep -v '^\s*$' | while IFS='|' read -r label file url; do
  if [ -s "pdfs/$file" ]; then echo "= $file (already present)"; continue; fi
  curl -sSL --retry 2 -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36" -o "pdfs/$file" "$url"
  if head -c 4 "pdfs/$file" | grep -q '%PDF'; then echo "✓ $label  $file"; else echo "✗ $label  $file  (not a PDF; check the url)"; rm -f "pdfs/$file"; fi
done
