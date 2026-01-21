#!/bin/bash

# Run Claude with the prompt, log output
cat scripts/ralph/prompt.md | claude \
  --output-format=stream-json \
  --verbose \
  --dangerously-skip-permissions \
  2>&1 | tee -a scripts/ralph/claude_output.jsonl
