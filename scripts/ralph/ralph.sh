#!/bin/bash

# RALPH - Infinite loop agent
# Usage: ./scripts/ralph/ralph.sh

echo "Starting RALPH loop..."

while :; do
  # Run sync (Claude session)
  ./scripts/ralph/sync.sh

  # Check for completion signal
  if [ -f "scripts/ralph/DONE" ]; then
    echo "RALPH complete - all tasks finished"
    rm "scripts/ralph/DONE"
    break
  fi

  echo "=== Loop iteration complete, sleeping 5s ==="
  sleep 5
done

echo "RALPH loop finished."
