#!/usr/bin/env bash
# Test Supabase request-password-reset function
# Usage: ./scripts/test-request-password-reset.sh you@example.com

EMAIL="${1:-test@example.com}"
URL="${NEXT_PUBLIC_SUPABASE_URL:-https://jcufigozkhxazjbwhjjm.supabase.co}"
ANON="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-sb_publishable_uJAV3NEF7ox4mzxkaI9iRg_uHIQ5mTn}"

echo "POST ${URL}/functions/v1/request-password-reset"
curl -v --fail --show-error \
  -X POST "${URL}/functions/v1/request-password-reset" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ANON}" \
  -H "apikey: ${ANON}" \
  -d "{\"email\":\"${EMAIL}\"}"

