.PHONY: setup

setup:
	pnpm install --frozen-lockfile || pnpm install
