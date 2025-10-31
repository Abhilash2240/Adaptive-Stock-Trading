#!/usr/bin/env bash
# Usage: ./deploy-wait.sh <SERVICE_ID>
# Requires environment variable RENDER_API_KEY to be set locally.
# Triggers a deploy and polls until completion, printing status updates.

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <SERVICE_ID>"
  exit 1
fi

SERVICE_ID="$1"

if [ -z "$RENDER_API_KEY" ]; then
  echo "Please set RENDER_API_KEY environment variable locally (do not commit it)."
  echo "Example: export RENDER_API_KEY=your_key_here"
  exit 1
fi

resp=$(curl -sS -X POST "https://api.render.com/v1/services/${SERVICE_ID}/deploys" \
  -H "Authorization: Bearer ${RENDER_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"clearCache": false, "message": "local: deploy-wait triggered"}')

echo "$resp" | jq . || true

deployId=$(echo "$resp" | jq -r .id)
if [ -z "$deployId" ] || [ "$deployId" = "null" ]; then
  echo "Failed to create deploy; response:"; echo "$resp"; exit 1
fi

echo "Polling deploy status for id=$deployId"
for i in $(seq 1 60); do
  status=$(curl -sS -H "Authorization: Bearer ${RENDER_API_KEY}" "https://api.render.com/v1/services/${SERVICE_ID}/deploys/${deployId}" | jq -r .status)
  echo "deploy status: $status (attempt $i)"
  if [ "$status" = "success" ]; then
    echo "Deploy succeeded"
    exit 0
  fi
  if [ "$status" = "failed" ]; then
    echo "Deploy failed"; exit 1
  fi
  sleep 10
done

echo "Timed out waiting for deploy"; exit 1
