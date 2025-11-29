# Prettier Alternatives Evaluation - Quick Guide

## 📋 Overview

This evaluation explores alternatives to Prettier for better formatting control, specifically addressing:
1. Inline object type formatting (currently condenses to single line)
2. Method chain breaking (no control over when chains break)

## 🎯 Quick Answer

**Recommended: Biome**
- 97% Prettier compatible
- 10-35x faster
- 1-2 day migration
- Low risk

**Alternative: dprint** (if you need more control)
- Maximum formatting control
- Specific solutions for object types and method chains
- 3-5 day migration

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| **[FORMATTER-RECOMMENDATION.md](./FORMATTER-RECOMMENDATION.md)** | Executive summary and recommendation |
| **[EVALUATION-CRITERIA-CHECKLIST.md](./EVALUATION-CRITERIA-CHECKLIST.md)** | Detailed evaluation against issue criteria |
| **[PRETTIER-ALTERNATIVES-EVALUATION.md](./PRETTIER-ALTERNATIVES-EVALUATION.md)** | Comprehensive analysis of all options |
| **[FORMATTING-EXAMPLES-COMPARISON.md](./FORMATTING-EXAMPLES-COMPARISON.md)** | Code examples showing how each tool formats |
| **[BIOME-MIGRATION-GUIDE.md](./BIOME-MIGRATION-GUIDE.md)** | Step-by-step Biome migration guide |
| **[DPRINT-MIGRATION-GUIDE.md](./DPRINT-MIGRATION-GUIDE.md)** | Step-by-step dprint migration guide |

## ⚙️ Configuration Files

Ready to use:
- **[`../biome.json`](../biome.json)** - Biome config (matches Prettier)
- **[`../dprint.json`](../dprint.json)** - dprint config (enhanced control)

## 🚀 Quick Start

### Option 1: Use Biome (Recommended)
```bash
pnpm add -D @biomejs/biome
pnpm biome format --write .
# Follow BIOME-MIGRATION-GUIDE.md
```

### Option 2: Test Both
```bash
pnpm add -D @biomejs/biome dprint
pnpm biome format --write src/entities/Files.ts
pnpm dprint fmt src/entities/Files.ts
git diff  # Compare
```

### Option 3: Stay with Prettier
```bash
# Remove evaluation files
rm biome.json dprint.json
```

## 📊 Comparison

| Feature | Prettier | Biome | dprint |
|---------|----------|-------|--------|
| Speed | Baseline | 10-35x | 10-30x |
| Object Control | ❌ | ⚠️ | ✅ |
| Chain Control | ❌ | ⚠️ | ✅ |
| Migration | N/A | 1-2 days | 3-5 days |
| Risk | N/A | Low | Medium |

## ❓ FAQ

**Q: Which should I choose?**  
A: Start with Biome for quick wins. Upgrade to dprint if you need more control.

**Q: Will it break my code?**  
A: No, formatting changes only.

**Q: Can I rollback?**  
A: Yes, easy rollback for both.

**Q: How long will it take?**  
A: 1-2 days for Biome, 3-5 days for dprint.

---

**Start here**: [FORMATTER-RECOMMENDATION.md](./FORMATTER-RECOMMENDATION.md)
