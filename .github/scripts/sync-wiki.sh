#!/usr/bin/env bash

# Wiki Sync Script
# Syncs docs/wiki/ content to GitHub Wiki repository

set -euo pipefail

# Configuration
SOURCE_DIR="${SOURCE_DIR:-main/docs/wiki}"
WIKI_DIR="${WIKI_DIR:-wiki}"
REPO_URL="${REPO_URL:-}"

echo "🔄 Wiki Sync Script"
echo "==================="
echo "Source: $SOURCE_DIR"
echo "Target: $WIKI_DIR"
echo ""

# Check if source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
    echo "❌ Error: Source directory $SOURCE_DIR does not exist"
    exit 1
fi

# Check if wiki directory exists
if [ ! -d "$WIKI_DIR" ]; then
    echo "❌ Error: Wiki directory $WIKI_DIR does not exist"
    exit 1
fi

# Function to clean wiki directory (preserve .git)
clean_wiki() {
    echo "🧹 Cleaning wiki directory..."
    find "$WIKI_DIR" -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +
}

# Function to copy files
copy_files() {
    echo "📁 Copying files from source to wiki..."

    # Copy all markdown files preserving directory structure
    if [ -d "$SOURCE_DIR" ]; then
        # Use rsync if available, otherwise use cp
        if command -v rsync &> /dev/null; then
            rsync -av --delete \
                --exclude='.git' \
                --exclude='*.backup' \
                --exclude='*.tmp' \
                "$SOURCE_DIR/" "$WIKI_DIR/"
        else
            cp -r "$SOURCE_DIR"/* "$WIKI_DIR/" 2>/dev/null || true
        fi
    fi

    echo "✅ Files copied successfully"
}

# Function to transform links for wiki format
transform_links() {
    echo "🔗 Transforming links for wiki format..."

    # Find all markdown files
    find "$WIKI_DIR" -type f -name "*.md" | while read -r file; do
        # Skip special wiki files
        if [[ "$(basename "$file")" =~ ^_(Footer|Sidebar)\.md$ ]]; then
            continue
        fi

        # Create temp file
        temp_file="${file}.tmp"

        # Transform links
        # 1. Remove docs/wiki/ prefix from links
        # 2. Remove .md extension for wiki links
        # 3. Handle relative paths
        sed -E \
            -e 's|\]\(docs/wiki/|\]\(|g' \
            -e 's|\]\(\.\./|\]\(|g' \
            -e 's|\.md\)|)|g' \
            "$file" > "$temp_file"

        # Replace original file
        mv "$temp_file" "$file"
    done

    echo "✅ Links transformed successfully"
}

# Function to handle special files
handle_special_files() {
    echo "📝 Handling special wiki files..."

    # Rename README.md to Home.md if it exists
    if [ -f "$WIKI_DIR/README.md" ]; then
        mv "$WIKI_DIR/README.md" "$WIKI_DIR/Home.md"
        echo "  - Renamed README.md to Home.md"
    fi

    # Ensure Home.md exists
    if [ ! -f "$WIKI_DIR/Home.md" ]; then
        echo "⚠️ Warning: No Home.md found, wiki may not have a landing page"
    fi
}

# Function to validate wiki structure
validate_wiki() {
    echo "✔️ Validating wiki structure..."

    # Check for required files
    if [ ! -f "$WIKI_DIR/Home.md" ]; then
        echo "⚠️ Warning: Home.md is missing"
    fi

    # Check for broken internal links
    echo "  - Checking for broken internal links..."
    broken_links=0

    # Use process substitution to avoid subshell and preserve broken_links counter
    while IFS= read -r file; do
        # Extract all markdown links (allow grep to return no matches without failing)
        while IFS= read -r link; do
            # Skip empty lines
            [[ -z "$link" ]] && continue

            # Skip external links
            if [[ "$link" =~ ^https?:// ]] || [[ "$link" =~ ^# ]]; then
                continue
            fi

            # Check if linked file exists
            linked_file="$WIKI_DIR/${link}.md"
            if [[ ! "$link" =~ ^\/ ]] && [[ ! -f "$linked_file" ]]; then
                # Try with directory structure
                dir=$(dirname "$file")
                linked_file="$dir/${link}.md"
                if [ ! -f "$linked_file" ]; then
                    echo "    ⚠️ Broken link in $(basename "$file"): $link"
                    ((broken_links++))
                fi
            fi
        done < <((grep -o '\[.*\]([^)]*)'  "$file" 2>/dev/null || true) | (grep -o '([^)]*)' || true) | tr -d '()')
    done < <(find "$WIKI_DIR" -type f -name "*.md")

    if [ $broken_links -eq 0 ]; then
        echo "  ✅ No broken links found"
    else
        echo "  ⚠️ Found $broken_links broken link(s)"
    fi

    echo "✅ Validation complete"
}

# Main execution
main() {
    echo "🚀 Starting wiki sync process..."
    echo ""

    # Step 1: Clean wiki directory
    clean_wiki

    # Step 2: Copy files
    copy_files

    # Step 3: Transform links
    transform_links

    # Step 4: Handle special files
    handle_special_files

    # Step 5: Validate structure
    validate_wiki

    echo ""
    echo "✨ Wiki sync completed successfully!"

    # List synced files
    echo ""
    echo "📊 Sync statistics:"
    echo "  - Total files: $(find "$WIKI_DIR" -type f -name "*.md" | wc -l)"
    echo "  - Categories: $(find "$WIKI_DIR" -type d -mindepth 1 | wc -l)"

    # Show directory structure
    if command -v tree &> /dev/null; then
        echo ""
        echo "📁 Wiki structure:"
        tree -I '.git' "$WIKI_DIR" || true
    fi
}

# Run main function
main