.PHONY: dev api install build preview kill help

PORT := 8765

## Start Vite dev server + API server concurrently
dev:
	npx concurrently \
	  --names "UI,API" \
	  --prefix-colors "cyan,magenta" \
	  "npm run dev" \
	  "python3 api/server.py"

## Start API server only
api:
	python3 api/server.py

## Install all dependencies (npm + pip)
install:
	npm install
	pip install fastapi "uvicorn[standard]" pillow numpy torch scikit-learn

## Build frontend for production
build:
	npm run build

## Preview production build
preview: build
	npm run preview

## Kill process on API port
kill:
	@lsof -ti :$(PORT) | xargs kill -9 2>/dev/null && echo "Killed :$(PORT)" || echo "Nothing on :$(PORT)"

## Show help
help:
	@echo ""
	@echo "  make dev      Start UI (localhost:5173) + API (localhost:$(PORT))"
	@echo "  make api      Start API server only"
	@echo "  make install  Install npm + pip dependencies"
	@echo "  make build    Production build"
	@echo "  make preview  Build + serve preview"
	@echo "  make kill     Kill API port"
	@echo ""
