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

## 📂 Project Structure

```
ieee-9bus-application/
├── README.md                      # This file
├── LICENSE                        # MIT License
├── requirements.txt               # Python dependencies
├── .gitignore                     # Git ignore rules
│
├── docs/                          # Documentation
│   ├── README.md                  # Doc navigation guide
│   ├── APPLICATION.md             # Full Master's application (4-5 pages)
│   ├── PROJECT_SUMMARY.md         # 1-page project overview
│   ├── RESEARCH_ABSTRACT.md       # 280-word research abstract
│   ├── DATASET.md                 # Dataset documentation
│   └── TECHNICAL_DOCUMENTATION.md # Complete technical guide
│
├── notebooks/                     # Jupyter notebooks
│   ├── main.ipynb                 # Complete implementation (START HERE)
│   └── additional.ipynb           # Additional experiments
│
├── papers/                        # Research papers
│   ├── ChronoGrid_FusionNet_Full_Paper.docx
│   └── Wisen-DLP-25-0065-*.pdf
│
└── code/                          # Implementation code
    └── server.py                  # Demo application
```

## 🚀 Quick Start

### 1. Clone Repository
```bash
git clone https://github.com/Bsanath27/ieee-9bus-application.git
cd ieee-9bus-application
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Run Notebook
```bash
jupyter notebook notebooks/main.ipynb
```

## 📖 Documentation

- **Getting Started**: Read [`docs/README.md`](docs/README.md)
- **Full Application**: See [`docs/APPLICATION.md`](docs/APPLICATION.md) (best for universities)
- **Project Overview**: See [`docs/PROJECT_SUMMARY.md`](docs/PROJECT_SUMMARY.md)
- **Technical Details**: See [`docs/TECHNICAL_DOCUMENTATION.md`](docs/TECHNICAL_DOCUMENTATION.md)
- **Dataset Info**: See [`docs/DATASET.md`](docs/DATASET.md)

## 🏗️ Architecture

```
Input [227×227 S-transform spectrogram]
  ↓
Multi-Scale 1D CNN (k=3, k=5)
  ↓
Bidirectional LSTM (2 layers, 128 hidden)
  ↓
Self-Attention (8 heads, 256 dim)
  ↓
Classification Head (11 fault classes)
```

## 📊 Results

| Model | Accuracy | F1-Score | Params |
|-------|----------|----------|--------|
| Baseline CNN | 95.90% | 95.40% | 53.2K |
| CNN+BiLSTM | 97.10% | 97.00% | 805.4K |
| **ChronoGrid FusionNet** | **98.50%** | **98.40%** | **1.059M** |

**Critical Class Performance** (Double-Line Faults):
- Baseline CNN: 91.4% F1 (14% miss rate)
- ChronoGrid FusionNet: 97.2% F1 (4% miss rate)

## 📦 Dataset

- **Source**: IEEE 9-Bus Network (ATP simulations)
- **Format**: 227×227 grayscale PNG images (S-transform)
- **Size**: 33,000 balanced images
- **Classes**: 11 fault types (AG, BG, CG, AB, AC, BC, ABG, ACG, BCG, ABCG, NF)
- **Split**: 70% train / 15% validation / 15% test (stratified)

## 🔬 Evaluation

- **Cross-Validation**: 5-fold stratified CV
- **Statistical Tests**: Paired t-test, McNemar's test (α = 0.05)
- **Metrics**: Accuracy, Precision, Recall, F1, AUC-ROC
- **Ablation Study**: 3 models comparing component contributions
- **Noise Robustness**: Augmentation at SNR 40/30/20 dB

## 📚 Notebooks

### `notebooks/main.ipynb` (Complete Implementation)
Contains:
- Data loading and preprocessing
- Model architecture definitions (4 models)
- Training loop with early stopping
- 5-fold cross-validation
- Ablation study evaluation
- 14 publication-quality visualizations
- Confusion matrices, ROC curves, attention maps
- Statistical significance tests

Run with: `jupyter notebook notebooks/main.ipynb`

## 🔍 Ablation Study

Three models compared to isolate component contributions:

1. **Baseline CNN** (53.2K params)
   - 1D CNN only
   - 95.90% accuracy

2. **CNN+BiLSTM** (805.4K params)
   - 1D CNN + BiLSTM (no attention)
   - 97.10% accuracy (+1.2 pp)

3. **ChronoGrid FusionNet** (1.059M params)
   - 1D CNN + BiLSTM + Self-Attention
   - **98.50% accuracy** (+2.6 pp)

All improvements statistically significant (p < 0.05)

## 🎯 For Master's Applications

Use these files in order:
1. [`docs/APPLICATION.md`](docs/APPLICATION.md) - Full application (4–5 pages)
2. [`docs/PROJECT_SUMMARY.md`](docs/PROJECT_SUMMARY.md) - Quick reference
3. [`notebooks/main.ipynb`](notebooks/main.ipynb) - Code implementation
4. Share this GitHub link

## 📄 Citation

```bibtex
@inproceedings{chronogrid2026,
  title={A Hybrid Deep Learning Approach for Detecting and Classifying 
         Transmission Line Faults Using ChronoGrid FusionNet Model},
  author={Sanath B. S.},
  year={2026},
  school={SRM Institute of Science and Technology}
}
```

## 📝 License

This project is licensed under the MIT License - see [`LICENSE`](LICENSE) file for details.

## 👤 Author

**Sanath B. S.**
- Email: bssanath27@gmail.com
- GitHub: [@Bsanath27](https://github.com/Bsanath27/)
- Institution: SRM Institute of Science and Technology, Ramapuram Campus

## 🔗 Links

- **Repository**: https://github.com/Bsanath27/ieee-9bus-application
- **Dataset**: WSCC 9-Bus Fault Dataset (IEEE/Kaggle)

---

**Status**: Final Year Project (Complete) ✅  
**Last Updated**: May 2026
