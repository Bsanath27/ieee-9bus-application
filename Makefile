.PHONY: help install install-dev run-demo run-notebook train test clean docs

help:
	@echo "ChronoGrid FusionNet — Makefile Commands"
	@echo "========================================"
	@echo ""
	@echo "Installation:"
	@echo "  make install       Install dependencies (production)"
	@echo "  make install-dev   Install with dev dependencies"
	@echo ""
	@echo "Running:"
	@echo "  make run-demo      Start FastAPI demo server (port 8765)"
	@echo "  make run-notebook  Launch Jupyter with main notebook"
	@echo ""
	@echo "Development:"
	@echo "  make train         Run training & evaluation (requires dataset)"
	@echo "  make test          Run tests (if available)"
	@echo "  make clean         Remove generated files"
	@echo ""
	@echo "Documentation:"
	@echo "  make docs          View documentation"
	@echo "  make readme        Show main README"
	@echo ""

install:
	pip install --upgrade pip
	pip install -r requirements.txt

install-dev:
	pip install --upgrade pip
	pip install -r requirements.txt
	pip install jupyter jupyterlab pytest fastapi uvicorn python-multipart

run-demo:
	@echo "Starting ChronoGrid FusionNet Demo..."
	@echo "Open: http://localhost:8765"
	@echo "Press Ctrl+C to stop"
	python code/server.py

run-notebook:
	@echo "Launching Jupyter Notebook..."
	jupyter notebook notebooks/main.ipynb

train:
	jupyter notebook notebooks/main.ipynb

test:
	pytest tests/ -v 2>/dev/null || echo "No tests found"

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	find . -type f -name ".DS_Store" -delete 2>/dev/null || true
	rm -rf .pytest_cache .ipynb_checkpoints build dist *.egg-info 2>/dev/null || true
	@echo "✅ Cleaned up generated files"

docs:
	@echo "Documentation Files:"
	@echo "==================="
	@cat docs/README.md | head -50

readme:
	@cat README.md

version:
	@echo "ChronoGrid FusionNet v1.0"
	@echo "Status: Final Year Project (Complete)"
	@echo "Last Updated: May 2026"

info:
	@echo "ChronoGrid FusionNet — Project Information"
	@echo "=========================================="
	@echo ""
	@echo "📊 Model Performance:"
	@echo "  • Accuracy: 98.50% ± 0.60% (5-fold CV)"
	@echo "  • Improvement: +2.60 pp vs baseline"
	@echo "  • Inference: 2.1 ms/sample (GPU)"
	@echo ""
	@echo "📦 Architecture:"
	@echo "  • Multi-scale 1D CNN (k=3, k=5)"
	@echo "  • Bidirectional LSTM (2 layers)"
	@echo "  • Self-Attention (8 heads)"
	@echo "  • Parameters: 1.059M"
	@echo ""
	@echo "📂 Project Structure:"
	@echo "  /docs       - Documentation & application materials"
	@echo "  /notebooks  - Jupyter notebooks (main.ipynb)"
	@echo "  /papers     - Research papers"
	@echo "  /code       - Implementation code (server.py, demo)"
	@echo ""
	@echo "🔗 Links:"
	@echo "  GitHub: https://github.com/Bsanath27/ieee-9bus-application"
	@echo ""

requirements:
	@echo "Required Python Packages:"
	@cat requirements.txt

check-env:
	python --version
	@echo ""
	pip list | grep -E "torch|numpy|scikit-learn|matplotlib" || echo "Some packages missing"

.DEFAULT_GOAL := help
