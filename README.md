# ChronoGrid FusionNet

**Hybrid Deep Learning for Transmission Line Fault Classification**

A PyTorch implementation of ChronoGrid FusionNet, a hybrid architecture integrating multi-scale 1D CNN, bidirectional LSTM, and self-attention for multi-class transmission line fault detection and classification on IEEE 9-bus power grid datasets.

## 🎯 Quick Facts

- **Accuracy**: 98.50% ± 0.60% (5-fold CV)
- **Improvement**: +2.60 pp vs. baseline CNN
- **Critical Class**: Double-Line fault recall 85.8% → 96.0% (+10.2 pp)
- **Architecture**: 1D CNN + BiLSTM + Self-Attention
- **Statistical Significance**: p < 0.01 (paired t-test, McNemar's test)
- **Inference Latency**: 2.1 ms/sample (GPU)
- **Model Parameters**: 1.059M

## 📂 Repository Contents

### Application Documents
- `01_Project_Summary.txt` - 1-page project overview
- `02_Research_Abstract.txt` - Formal research abstract (250 words)
- `03_GitHub_README.md` - Complete GitHub documentation
- `04_Dataset_Description.txt` - Detailed dataset documentation
- `05_MASTER_APPLICATION_DOCUMENT.txt` - Full 4-5 page application document
- `README_APPLICATION_DOCS.txt` - Navigation guide

### Code & Notebooks
- `chronogrid_fusionnet.ipynb` - Complete implementation with all experiments
- `notebooks/` - Additional Jupyter notebooks
- `demo/` - Demo server code (React + FastAPI)

### Research Papers
- `*.pdf` - Research papers and technical reports
- `*.docx` - Research paper drafts

## 📋 Dataset

**WSCC 9-Bus Fault Dataset**
- 33,000 balanced images (227×227 S-transform spectrograms)
- 11 fault classes (AG, BG, CG, AB, AC, BC, ABG, ACG, BCG, ABCG, NF)
- Train/Val/Test: 70% / 15% / 15% stratified split

## 🚀 Quick Start

### Installation
```bash
git clone https://github.com/Bsanath27/ieee-9bus-application.git
cd ieee-9bus-application
pip install -r requirements.txt
```

### Run Training
```bash
jupyter notebook chronogrid_fusionnet.ipynb
```

### Results
- 5-fold cross-validation: 98.50% accuracy
- Confusion matrices, ROC curves, per-class F1 scores
- Attention weight visualizations
- All 14 publication-quality figures

## 🏗️ Architecture

```
Input [227×227 S-transform] 
  ↓
Multi-Scale 1D CNN (kernels k=3, k=5)
  ↓
Bidirectional LSTM (2 layers, 128 hidden)
  ↓
Self-Attention (8 heads, 256 dim)
  ↓
Classification Head (11 fault classes)
  ↓
Output: Fault prediction + attention weights
```

## 📊 Results Summary

| Model | Accuracy | F1-Score | vs. Baseline |
|-------|----------|----------|-------------|
| Baseline CNN | 95.90% | 95.40% | — |
| CNN+BiLSTM | 97.10% | 97.00% | +1.20 pp |
| **ChronoGrid FusionNet** | **98.50%** | **98.40%** | **+2.60 pp** |

## 📈 Key Improvements

- Double-Line fault recall: **85.8% → 96.0%** (+10.2 pp)
- Normal-class precision: **99.2%** (near-zero false alarms)
- Statistical significance: **p < 0.01** (paired t-test)
- Inference latency: **2.1 ms/sample** (suitable for relay applications)

## 🔗 Links

- **GitHub Repository**: https://github.com/Bsanath27/ieee-9bus-application
- **Project Documentation**: See `05_MASTER_APPLICATION_DOCUMENT.txt`
- **Dataset**: WSCC 9-Bus Fault Dataset (IEEE/Kaggle)

## 📝 Citation

If you use this work, please cite:

```bibtex
@inproceedings{chronogrid2026,
  title={A Hybrid Deep Learning Approach for Detecting and Classifying Transmission Line Faults Using ChronoGrid FusionNet Model},
  author={Sanath B. S.},
  year={2026},
  school={SRM Institute of Science and Technology}
}
```

## 👤 Author

**Sanath B. S.**
- Institution: SRM Institute of Science and Technology, Ramapuram Campus
- Email: bssanath27@gmail.com
- GitHub: https://github.com/Bsanath27/

## 📄 License

MIT License - See LICENSE file for details

---

**Status**: Final Year Project (Complete) ✅  
**Last Updated**: May 2026
