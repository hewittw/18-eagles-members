#!/usr/bin/env bash
# Run by the USER (the agent may not read .env files): copies this app's keys from .env.local into the
# Vercel project 18-eagles-members, without printing any value.
# Usage: scripts/push-env.sh                     → Production
#        scripts/push-env.sh preview             → Preview, all branches (Assignment 5 deploys the live-data branch as a
#        preview). Branch-scoped vars need a Git-connected project, which this one isn't.
# CLERK_SECRET_KEY is added as --sensitive (write-only in the Vercel dashboard).
set -euo pipefail
cd "$(dirname "$0")/.."
TARGET="${1:-production}"; BRANCH="${2:-}"
VARS=(NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY CLERK_SECRET_KEY
      NEXT_PUBLIC_CLERK_SIGN_IN_URL NEXT_PUBLIC_CLERK_SIGN_UP_URL
      NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL)
for name in "${VARS[@]}"; do
  value=$(grep -E "^${name}=" .env.local | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' || true)
  if [ -z "$value" ]; then echo "skip   $name (not in .env.local)"; continue; fi
  vercel env rm "$name" "$TARGET" $BRANCH --yes >/dev/null 2>&1 || true
  flag=""; [ "$name" = "CLERK_SECRET_KEY" ] && flag="--sensitive"
  printf '%s' "$value" | vercel env add "$name" "$TARGET" $BRANCH $flag >/dev/null 2>"${TMPDIR:-/tmp}/push-env.err" && echo "added  $name → $TARGET $BRANCH" || { echo "FAILED $name → $TARGET $BRANCH:"; grep -iE "error|message" "${TMPDIR:-/tmp}/push-env.err" | grep -v -i key | head -2; }
done
