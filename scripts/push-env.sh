#!/usr/bin/env bash
# Run by the USER (the agent may not read .env files): copies this app's keys from .env.local into the
# Vercel project 18-eagles-members for Production and Preview, without printing any value.
# CLERK_SECRET_KEY is added as --sensitive (write-only in the Vercel dashboard).
set -euo pipefail
cd "$(dirname "$0")/.."
VARS=(NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY CLERK_SECRET_KEY
      NEXT_PUBLIC_CLERK_SIGN_IN_URL NEXT_PUBLIC_CLERK_SIGN_UP_URL)
for name in "${VARS[@]}"; do
  value=$(grep -E "^${name}=" .env.local | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' || true)
  if [ -z "$value" ]; then echo "skip   $name (not in .env.local)"; continue; fi
  for target in production preview; do
    vercel env rm "$name" "$target" --yes >/dev/null 2>&1 || true
    flag=""; [ "$name" = "CLERK_SECRET_KEY" ] && flag="--sensitive"
    printf '%s' "$value" | vercel env add "$name" "$target" $flag >/dev/null 2>&1 && echo "added  $name → $target" || echo "FAILED $name → $target"
  done
done
