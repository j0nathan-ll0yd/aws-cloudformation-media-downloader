#!/bin/bash
# Script to generate codebase context for Claude Code sessions

if [ ! -f "repomix-output.xml" ]; then
    echo "Generating context file..."
    pnpm run pack:context
fi

echo "Context file ready: repomix-output.xml"
echo ""
echo "Note: Claude Code automatically reads CLAUDE.md and AGENTS.md."
echo "For additional context, you can reference the generated file with:"
echo "  - Drag and drop repomix-output.xml into the conversation"
echo "  - Or copy relevant sections as needed"
