# ChronoGrid FusionNet

**Hybrid Deep Learning for Transmission Line Fault Classification**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Python 3.9+](https://img.shields.io/badge/python-3.9+-blue.svg)](https://www.python.org/downloads/)
[![PyTorch 2.0+](https://img.shields.io/badge/PyTorch-2.0+-red.svg)](https://pytorch.org/)

## ⚡ Quick Facts

- **Accuracy**: 98.50% ± 0.60% on 11-class fault classification
- **Dataset**: WSCC 9-Bus (33,000 S-transform images, perfectly balanced)
- **Architecture**: Multi-scale CNN + BiLSTM + Self-Attention
- **Critical Improvement**: Double-Line fault recall 85.8% → 96.0% (+10.2 pp)
- **Statistical Significance**: p < 0.01 (paired t-test)
- **Inference**: 2.1 ms/sample (suitable for 0–2 ms relay response)

## 🚀 Quick Start — Interactive Demo

The easiest way to try ChronoGrid FusionNet:

```bash
# One command to start the demo
make run-demo

# Then open: http://localhost:8765
```

**Features**:
- ✓ Real-time fault classification with 11 classes
- ✓ S-transform heatmap visualization
- ✓ Confidence scores and inference latency
- ✓ Noise robustness testing (σ = 0.0–0.2)
- ✓ Interactive sample selection (1–3000 per class)

See [`demo/README.md`](demo/README.md) for full documentation.

---

## 📂 Project Structure

```
ieee-9bus-application/
├── README.md                      # This file
├── LICENSE                        # MIT License
├── Makefile                       # Command automation (make run-demo, make train, etc.)
├── requirements.txt               # Python dependencies
├── .gitignore                     # Git ignore rules
│
├── docs/                          # Application & documentation
│   ├── README.md                  # Navigation guide
│   ├── APPLICATION.md             # Full Master's application (4–5 pages)
│   ├── PROJECT_SUMMARY.md         # 1-page project overview
│   ├── RESEARCH_ABSTRACT.md       # 280-word research abstract
│   ├── TECHNICAL_DOCUMENTATION.md # Complete technical guide
│   ├── DATASET.md                 # Dataset documentation
│   └── DEMO.md                    # Demo troubleshooting & examples
│
├── notebooks/                     # Jupyter notebooks
│   ├── main.ipynb                 # Complete implementation (START HERE)
│   └── additional.ipynb           # Additional experiments & ablations
│
├── papers/                        # Research papers & PDFs
│   ├── ChronoGrid_FusionNet_Full_Paper.docx
│   └── Wisen-DLP-25-0065-*.pdf
│
├── code/                          # Implementation code
│   └── server.py                  # FastAPI backend server
│
├── demo/                          # Interactive web demo
│   ├── README.md                  # Demo documentation
│   ├── index.html                 # Web interface (HTML5 + JavaScript)
│   └── styles.css                 # Demo styling
│
└── models/                        # Trained model checkpoints
    ├── README.md                  # Model documentation
    ├── download_models.py         # Automated model downloader
    └── .gitignore                 # Exclude large .pt files
```

## 🎯 Use Cases

### 1. **Try the Demo** (5 min)
```bash
make run-demo
# Open http://localhost:8765
```

### 2. **Review Project** (15 min)
Read [`docs/APPLICATION.md`](docs/APPLICATION.md) for full context, or [`docs/PROJECT_SUMMARY.md`](docs/PROJECT_SUMMARY.md) for a quick 1-page overview.

### 3. **Understand Implementation** (1 hour)
Open `notebooks/main.ipynb` to see:
- Dataset loading & preprocessing
- Model architecture definitions
- Training loops with 5-fold cross-validation
- Ablation study (4 models)
- 14 publication-quality visualizations
- Statistical significance tests

### 4. **Train from Scratch** (4 hours)
```bash
# Requires WSCC 9-Bus dataset in wscc9FaultDataset/
make train

# Or manually:
jupyter notebook notebooks/main.ipynb
```

---

## 🏗️ Architecture

### ChronoGrid FusionNet (Best Model)

```
Input [B, 227, 227] (S-transform spectrogram)
  ↓
Multi-Scale 1D CNN (kernels k=3 and k=5)
  └─ Output: [B, 256, 56] (256 feature channels)
  ↓
Bidirectional LSTM (2 layers, 128 hidden)
  └─ Output: [B, 56, 256] (bidirectional context)
  ↓
Self-Attention (8 heads, scaled dot-product)
  └─ Output: [B, 56, 256] (adaptive temporal weighting)
  ↓
Classification Head
  ├─ Global Average Pool → [B, 256]
  ├─ FC(256→128) + ReLU + Dropout(0.3)
  └─ FC(128→11) + Softmax → [B, 11]
  ↓
Output: Fault class logits (11 classes)
```

### Model Specifications

| Component | Details |
|-----------|---------|
| Input Size | 227×227 pixels (fixed) |
| Input Type | Grayscale S-transform spectrogram |
| Num Classes | 11 (AG, BG, CG, AB, AC, BC, ABG, ACG, BCG, ABCG, NF) |
| Total Parameters | 1.059M |
| GPU Memory | ~50 MB |
| Inference Latency | 2.1 ms (GPU) / 45 ms (CPU) |
| Training Time | ~30 min/fold (GPU) |

---

## 📊 Results

### Classification Accuracy (5-Fold CV)

| Model | Accuracy | F1-Score | Parameters |
|-------|----------|----------|------------|
| BiLSTM-Only | 94.20% ± 1.80% | 93.80% ± 2.00% | — |
| **Baseline CNN** | **95.90% ± 1.20%** | **95.40% ± 1.30%** | **53.2K** |
| CNN+BiLSTM | 97.10% ± 0.90% | 97.00% ± 1.00% | 805.4K |
| **ChronoGrid FusionNet** | **98.50% ± 0.60%** | **98.40% ± 0.70%** | **1.059M** |

### Critical Improvements

- **Double-Line Fault Recall**: 85.8% → 96.0% (+10.2 pp)
- **Normal-Class Precision**: 99.2% (near-zero false alarms)
- **Macro-Average F1**: 98.5% (strong balance across all classes)
- **Statistical Significance**: p < 0.01 (paired t-test)

### Ablation Analysis

Each component's independent contribution:
- **CNN baseline**: 95.90% (localized feature extraction)
- **+BiLSTM**: 97.10% (+1.2 pp temporal modeling)
- **+Self-Attention**: 98.50% (+1.4 pp adaptive weighting)

---

## 🛠️ Installation

### Requirements
- Python 3.9+
- PyTorch 2.0+
- FastAPI (for demo)
- Jupyter (for experiments)

### Setup

```bash
# Clone repository
git clone https://github.com/Bsanath27/ieee-9bus-application.git
cd ieee-9bus-application

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### Download Models (Optional)

```bash
cd models
python download_models.py

# Or just the best model:
python download_models.py --model chronogrid_fusionnet_fold5
```

---

## 📖 Documentation

| Document | Purpose | Audience |
|----------|---------|----------|
| [`docs/APPLICATION.md`](docs/APPLICATION.md) | Complete Master's application (4–5 pages) | University admissions |
| [`docs/PROJECT_SUMMARY.md`](docs/PROJECT_SUMMARY.md) | 1-page project overview | Quick reference |
| [`docs/RESEARCH_ABSTRACT.md`](docs/RESEARCH_ABSTRACT.md) | 280-word research abstract | Conference submissions |
| [`docs/TECHNICAL_DOCUMENTATION.md`](docs/TECHNICAL_DOCUMENTATION.md) | Complete technical guide | Developers |
| [`docs/DATASET.md`](docs/DATASET.md) | Dataset specification | Researchers |
| [`demo/README.md`](demo/README.md) | Demo usage & API | Users |

---

## 🎓 Master's Application Materials

All documents ready for university submission:

- ✓ **PROJECT_SUMMARY.md** — 1-page concise overview (elevator pitch)
- ✓ **RESEARCH_ABSTRACT.md** — Formal research abstract (280 words)
- ✓ **APPLICATION.md** — Complete 4–5 page application document
- ✓ **DATASET.md** — Comprehensive dataset documentation
- ✓ **TECHNICAL_DOCUMENTATION.md** — Full technical implementation details

**Usage**: Copy [`docs/APPLICATION.md`](docs/APPLICATION.md) into your Master's application portal, or use individual sections as needed.

---

## 🔗 GitHub & Resources

- **Repository**: https://github.com/Bsanath27/ieee-9bus-application
- **Demo**: http://localhost:8765 (after `make run-demo`)
- **Author**: Sanath B. S. (bssanath27@gmail.com)
- **Institution**: SRM Institute of Science and Technology, Ramapuram Campus

---

## 📝 Citation

If you use this work in research or applications, please cite:

```bibtex
@inproceedings{chronogrid2026,
  title={A Hybrid Deep Learning Approach for Detecting and Classifying Transmission Line Faults Using ChronoGrid FusionNet Model},
  author={Sanath B. S.},
  year={2026},
  school={SRM Institute of Science and Technology}
}
```

---

## 📄 License

This project is released under the MIT License. See [`LICENSE`](LICENSE) for details.

---

## 🤝 Contributing

Found a bug? Have suggestions? Please open an issue on GitHub:
https://github.com/Bsanath27/ieee-9bus-application/issues

---

**Last Updated**: May 2026  
**Status**: Production-Ready ✓  
**Next Steps**: Deploy demo to cloud, collect real-world validation data, extend to multi-terminal HVDC systems

