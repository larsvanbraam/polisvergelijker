#!/usr/bin/env bash
# Bouwt site/data.json opnieuw en zet de site handmatig op Vercel.
# Met de GitHub-koppeling in Vercel (Root Directory: site) is dit niet meer nodig: elke push naar main gaat live.
set -euo pipefail
cd "$(dirname "$0")"
python3 build.py
cd site
if [ "${1:-}" = "--preview" ]; then
  npx --yes vercel@latest deploy
else
  npx --yes vercel@latest deploy --prod
fi
