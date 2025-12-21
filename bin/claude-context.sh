#!/bin/bash
# Script to start Claude CLI with full codebase context from repomix

if [ ! -f "repomix-output.xml" ]; then
    echo "Generating context file..."
    pnpm run pack:context
fi

# Use the -s flag if using claude-code or similar, 
# but for standard Claude CLI we might just pipe it or use a system prompt.
# Adjust this based on your specific Claude CLI tool.
# For 'claude' from Anthropic:
claude --system "$(cat repomix-output.xml)" "$@"
