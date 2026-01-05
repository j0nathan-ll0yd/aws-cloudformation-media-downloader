#!/usr/bin/env bash

# Generate Sidebar Script
# Creates _Sidebar.md for GitHub Wiki navigation

set -euo pipefail
shopt -s nullglob  # Allow glob patterns to expand to empty list if no matches

# Configuration
SOURCE_DIR="${SOURCE_DIR:-docs/wiki}"  # Read structure from source
WIKI_DIR="${WIKI_DIR:-wiki}"           # Write sidebar to wiki
SIDEBAR_FILE="$WIKI_DIR/_Sidebar.md"

echo "📋 Generating sidebar navigation..."
echo "==================================="
echo "Wiki directory: $WIKI_DIR"
echo "Output file: $SIDEBAR_FILE"
echo ""

# Check if directories exist
if [ ! -d "$SOURCE_DIR" ]; then
    echo "❌ Error: Source directory $SOURCE_DIR does not exist"
    exit 1
fi
if [ ! -d "$WIKI_DIR" ]; then
    echo "❌ Error: Wiki directory $WIKI_DIR does not exist"
    exit 1
fi

# Function to get clean page title from filename
get_page_title() {
    local filename="$1"
    local basename
    basename=$(basename "$filename" .md)

    # Convert filename to title
    echo "$basename" | sed -E 's/-/ /g' | sed -E 's/\b(\w)/\u\1/g'
}

# Function to process directory recursively
process_directory() {
    local dir="$1"
    local indent="$2"
    local parent_path="$3"

    # Get all markdown files in current directory
    for file in "$dir"/*.md; do
        if [ ! -f "$file" ]; then
            continue
        fi

        local basename
        basename=$(basename "$file" .md)

        # Skip special wiki files
        if [[ "$basename" =~ ^_(Footer|Sidebar)$ ]]; then
            continue
        fi

        # Skip Home.md in subdirectories (only use root Home.md)
        if [[ "$basename" == "Home" ]] && [[ "$dir" != "$WIKI_DIR" ]]; then
            continue
        fi

        # Create link path (relative to wiki root)
        local link_path=""
        if [ -z "$parent_path" ]; then
            link_path="$basename"
        else
            link_path="$parent_path/$basename"
        fi

        # Get page title
        local title
        title=$(get_page_title "$file")

        # Special handling for Home.md
        if [[ "$basename" == "Home" ]]; then
            title="🏠 Home"
            link_path="Home"
        fi

        # Add to sidebar
        echo "${indent}- [$title]($link_path)" >> "$SIDEBAR_FILE"
    done

    # Process subdirectories
    for subdir in "$dir"/*/; do
        if [ ! -d "$subdir" ]; then
            continue
        fi

        local dirname
        dirname=$(basename "$subdir")

        # Skip hidden directories
        if [[ "$dirname" =~ ^\. ]]; then
            continue
        fi

        # Add category header
        echo "" >> "$SIDEBAR_FILE"

        # Determine category emoji based on name
        local emoji=""
        case "$dirname" in
            Conventions) emoji="📋" ;;
            TypeScript) emoji="🎯" ;;
            Testing) emoji="🧪" ;;
            AWS) emoji="☁️" ;;
            Bash) emoji="📜" ;;
            Infrastructure) emoji="🏗️" ;;
            Methodologies) emoji="💡" ;;
            Meta) emoji="🔮" ;;
            *) emoji="📁" ;;
        esac

        # Add category title
        local category_title
        category_title=$(get_page_title "$dirname")
        echo "${indent}**$emoji $category_title**" >> "$SIDEBAR_FILE"

        # Process files in subdirectory
        local subdir_path=""
        if [ -z "$parent_path" ]; then
            subdir_path="$dirname"
        else
            subdir_path="$parent_path/$dirname"
        fi

        process_directory "$subdir" "$indent" "$subdir_path"
    done
}

# Main execution
main() {
    # Start fresh
    cat > "$SIDEBAR_FILE" << 'EOF'
# Navigation

## Quick Links

- [🏠 Home](Home)
- [🚀 Getting Started](Getting-Started)

---

## Documentation
EOF

    echo "" >> "$SIDEBAR_FILE"

    # Process root level files (except Home and Getting-Started which are already added)
    for file in "$SOURCE_DIR"/*.md; do
        if [ ! -f "$file" ]; then
            continue
        fi

        local basename
        basename=$(basename "$file" .md)

        # Skip special files and already added files
        if [[ "$basename" =~ ^_(Footer|Sidebar)$ ]] || \
           [[ "$basename" == "Home" ]] || \
           [[ "$basename" == "Getting-Started" ]]; then
            continue
        fi

        local title
        title=$(get_page_title "$file")
        echo "- [$title]($basename)" >> "$SIDEBAR_FILE"
    done

    # Process each category directory from source
    for dir in "$SOURCE_DIR"/*/; do
        if [ ! -d "$dir" ]; then
            continue
        fi

        local dirname
        dirname=$(basename "$dir")

        # Skip hidden directories
        if [[ "$dirname" =~ ^\. ]]; then
            continue
        fi

        echo "" >> "$SIDEBAR_FILE"

        # Determine category emoji
        local emoji=""
        case "$dirname" in
            Conventions) emoji="📋" ;;
            TypeScript) emoji="🎯" ;;
            Testing) emoji="🧪" ;;
            AWS) emoji="☁️" ;;
            Bash) emoji="📜" ;;
            Infrastructure) emoji="🏗️" ;;
            Methodologies) emoji="💡" ;;
            Meta) emoji="🔮" ;;
            *) emoji="📁" ;;
        esac

        # Add category section
        local category_title
        category_title=$(get_page_title "$dirname")
        echo "### $emoji $category_title" >> "$SIDEBAR_FILE"
        echo "" >> "$SIDEBAR_FILE"

        # Process files in category
        for file in "$dir"/*.md; do
            if [ ! -f "$file" ]; then
                continue
            fi

            local basename
            local title
            basename=$(basename "$file" .md)
            title=$(get_page_title "$file")
            # GitHub Wiki has flat namespace - use basename only
            echo "- [$title]($basename)" >> "$SIDEBAR_FILE"
        done

        # Process subdirectories if any
        for subdir in "$dir"/*/; do
            if [ ! -d "$subdir" ]; then
                continue
            fi

            local subdirname
            subdirname=$(basename "$subdir")
            echo "  - **$(get_page_title "$subdirname")**" >> "$SIDEBAR_FILE"

            for file in "$subdir"/*.md; do
                if [ ! -f "$file" ]; then
                    continue
                fi

                local basename
                local title
                basename=$(basename "$file" .md)
                title=$(get_page_title "$file")
                # GitHub Wiki has flat namespace - use basename only
                echo "    - [$title]($basename)" >> "$SIDEBAR_FILE"
            done
        done
    done

    # Add footer section
    cat >> "$SIDEBAR_FILE" << 'EOF'

---

## Resources

- [📚 Main Repository](https://github.com/${GITHUB_REPOSITORY})
- [📖 View in GitHub](https://github.com/${GITHUB_REPOSITORY}/tree/main/docs/wiki)
- [🐛 Report Issue](https://github.com/${GITHUB_REPOSITORY}/issues)
EOF

    echo "✅ Sidebar generated successfully!"
    echo ""
    echo "📊 Sidebar statistics:"
    echo "  - Lines: $(wc -l < "$SIDEBAR_FILE")"
    echo "  - Categories: $(grep -c '^###' "$SIDEBAR_FILE" || echo 0)"
    echo "  - Links: $(grep -c '\[.*\](' "$SIDEBAR_FILE" || echo 0)"

    # Show preview
    echo ""
    echo "📄 Sidebar preview (first 20 lines):"
    echo "-----------------------------------"
    head -20 "$SIDEBAR_FILE"
    echo "..."
}

# Run main function
main