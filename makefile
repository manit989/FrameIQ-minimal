.PHONY: dev
dev:
	PYTHONPATH=. uv run uvicorn src.api.main:app --reload --port 8000
#just run "make dev"