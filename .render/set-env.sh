#!/usr/bin/env bash
# Usage: ./set-env.sh <SERVICE_ID> <KEY> <VALUE>
# Example: ./set-env.sh srv-abc123 RENDER_API_KEY rnd_Q4JdMWMttE0Cm2Wp4hO9WaBILxeX

if [ "$#" -ne 3 ]; then
  echo "Usage: $0 <SERVICE_ID> <KEY> <VALUE>"
  exit 1
fi

SERVICE_ID="$1"
KEY="$2"
VALUE="$3"

if [ -z "$RENDER_API_KEY" ]; then
  echo "Please set RENDER_API_KEY environment variable locally (do not commit it)."
  echo "Example: export RENDER_API_KEY=your_key_here"
  exit 1
fi

# Create env var. If it already exists this will create another; see Render API for update operations.
curl -sS -X POST "https://api.render.com/v1/services/${SERVICE_ID}/env-vars" \
  -H "Authorization: Bearer ${RENDER_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{ \"key\": \"${KEY}\", \"value\": \"${VALUE}\", \"scope\": \"RUN_TIME\" }" \
  | jq .
