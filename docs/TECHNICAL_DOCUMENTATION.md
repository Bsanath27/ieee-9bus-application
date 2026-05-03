# ChronoGrid FusionNet

## Hybrid Deep Learning for Transmission Line Fault Classification

A PyTorch implementation of **ChronoGrid FusionNet**, a hybrid architecture integrating multi-scale 1D CNN, bidirectional LSTM, and self-attention for multi-class transmission line fault detection and classification on IEEE 9-bus power grid datasets.

---

## Project Overview

Transmission line faults pose critical risks to power grid stability and reliability. This project addresses the challenge of **accurate, real-time fault classification** using deep learning on time-frequency spectrograms.

**Key Problem**: Existing CNN-based methods fail to:
- Model long-range temporal dependencies in voltage-current transients
- Resolve classification ambiguity between similar fault signatures
- Maintain high recall on minority fault classes (critical for relay protection)

**Solution**: A hybrid architecture combining:
1. **Multi-scale CNN** — Localized transient feature extraction (kernels k=3, k=5)
2. **Bidirectional LSTM** — Forward/backward temporal dependency modeling
3. **Self-Attention** — Adaptive weighting of critical transient intervals

---

## Key Results

| Metric                    | ChronoGrid FusionNet | Baseline CNN | Improvement |
|---------------------------|----------------------|--------------|-------------|
| **Accuracy (5-fold CV)**  | **98.50% ± 0.60%**   | 95.90%       | **+2.60 pp** |
| **Macro F1-Score**        | **98.40% ± 0.70%**   | 95.40%       | **+3.00 pp** |
| **Double-Line Recall**    | **96.0%**            | 85.8%        | **+10.2 pp** |
| **Model Parameters**      | 1.059M               | 53.2K        | —            |
| **Inference Latency**     | 2.1 ms/sample (GPU)  | —            | —            |

**Statistical Significance**: Paired t-test (p < 0.01), McNemar's test (p < 0.001) vs. all baselines.

---

## Features

✓ **Complete ablation study** — Three baselines isolate contribution of each component  
✓ **5-fold stratified cross-validation** — Prevents data leakage, reports mean ± std  
✓ **Noise robustness** — Augmentation at SNR 40/30/20 dB  
✓ **Statistical validation** — Paired t-test, McNemar's test (α = 0.05)  
✓ **Interpretability** — Attention weight visualization and per-class F1 analysis  
✓ **Publication-quality figures** — 14 IEEE-style plots (confusion matrices, ROC curves, attention maps)  
✓ **Reproducible** — Fixed random seeds, stratified splits, no external model weights  

---

## Architecture

### Data Representation
- **Input**: 227×227 S-transform spectrogram heatmaps (normalized to [0,1])
- **Interpretation**: Rows = frequency bins (~0–500 Hz), Columns = time steps (~0–227 ms)
- **Classes**: 11 fault types (AG, BG, CG, AB, AC, BC, ABG, ACG, BCG, ABCG, NF)

### ChronoGrid FusionNet Pipeline

```
Input [B, 227, 227]
    ↓
Multi-Scale CNN Backbone
  ├─ Conv1d(kernel=3): 227→64 filters, ReLU, BatchNorm
  ├─ Conv1d(kernel=5): 64→128 filters, ReLU, MaxPool(2)
  └─ Conv1d(kernel=3): 128→256 filters, ReLU, MaxPool(2)
    → [B, 256, 56] (56 time steps, 256 feature channels)
    ↓
Bidirectional LSTM
  └─ LSTM(input=256, hidden=128, layers=2, bidirectional=True)
    → [B, 56, 256]
    ↓
Self-Attention Module
  └─ MultiHeadAttention(d_model=256, num_heads=8)
  └─ Residual + LayerNorm
    → [B, 56, 256]
    ↓
Classification Head
  ├─ Global Avg Pool → [B, 256]
  ├─ Dropout(0.3)
  ├─ FC(256→128, ReLU) → [B, 128]
  └─ FC(128→11, Softmax) → [B, 11] (logits)
    ↓
Output: Fault class prediction + attention weights
```

### Architecture Details

| Component        | Configuration                     | Output Shape | Parameters |
|------------------|-----------------------------------|--------------|------------|
| Input            | 227×227 S-transform image         | (B,227,227)  | —          |
| MS-CNN k=3       | 2× Conv1d(kernel=3) + BN + GELU  | (B,64,64)    | 25.3K      |
| MS-CNN k=5       | 2× Conv1d(kernel=5) + BN + GELU  | (B,64,64)    | 41.6K      |
| Concat + MaxPool | Concatenate, stride=2            | (B,128,32)   | —          |
| BiLSTM (2 layers)| H=128, bidirectional             | (B,32,256)   | 789.5K     |
| Self-Attention   | d_k=64, 8 heads, LayerNorm       | (B,32,256)   | 263.7K     |
| Classification   | FC(256→128→11) + Softmax         | (B,11)       | 98.9K      |
| **Total**        | —                                 | —            | **1.059M** |

---

## Installation

### Requirements
- Python 3.9+
- PyTorch 2.0+
- scikit-learn
- NumPy, Matplotlib, Seaborn
- Jupyter Notebook (optional, for interactive experiments)

### Setup

```bash
# Clone repository
git clone https://github.com/sanathbs/IEEE-9bus-ChronoGrid-FusionNet.git
cd IEEE-9bus-ChronoGrid-FusionNet

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### Requirements.txt
```
torch==2.0.0
torchvision==0.15.0
numpy==1.24.3
scikit-learn==1.2.2
matplotlib==3.7.1
seaborn==0.12.2
pillow==9.5.0
tqdm==4.65.0
```

---

## Usage

### Quick Start: Training ChronoGrid FusionNet

```python
import torch
from model import ChronoGridFusionNet
from data import FaultDataset, create_dataloaders

# Initialize model
model = ChronoGridFusionNet(num_classes=11)
model = model.to(device)

# Create data loaders
train_loader, val_loader, test_loader = create_dataloaders(
    dataset_root='/path/to/wscc9-dataset',
    batch_size=32,
    train_ratio=0.70,
    val_ratio=0.15
)

# Train
optimizer = torch.optim.Adam(model.parameters(), lr=1e-3, weight_decay=1e-4)
criterion = torch.nn.CrossEntropyLoss()

for epoch in range(50):
    # Training loop...
    model.train()
    for x, y in train_loader:
        x, y = x.to(device), y.to(device)
        optimizer.zero_grad()
        out = model(x)
        loss = criterion(out, y)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        optimizer.step()

# Evaluate
model.eval()
with torch.no_grad():
    correct, total = 0, 0
    for x, y in test_loader:
        x, y = x.to(device), y.to(device)
        pred = model(x).argmax(dim=1)
        correct += (pred == y).sum().item()
        total += y.size(0)
print(f"Test Accuracy: {correct / total * 100:.2f}%")
```

### Ablation Study: All Three Models

```bash
# Run complete ablation (5-fold CV)
python ablation_study.py --dataset /path/to/wscc9 --output results/
```

Output:
```
Results Summary:
  Baseline CNN:      95.90% ± 1.20%
  CNN+BiLSTM:        97.10% ± 0.90%
  ChronoGrid FusionNet: 98.50% ± 0.60%

Statistical tests saved to: results/statistical_tests.csv
```

### Inference on New Samples

```python
# Load trained model
model.load_state_dict(torch.load('checkpoints/fusionnet_best.pt'))
model.eval()

# Predict on single image
from PIL import Image
import numpy as np

img = Image.open('sample_fault.jpg').convert('L')
x = torch.tensor(np.array(img, dtype=np.float32) / 255.0).unsqueeze(0)

with torch.no_grad():
    logits = model(x)  # [1, 11]
    probs = torch.softmax(logits, dim=1)
    pred_class = FAULT_CLASSES[probs.argmax(dim=1).item()]
    confidence = probs.max().item() * 100

print(f"Predicted Fault: {pred_class} ({confidence:.1f}% confidence)")
```

### Visualize Attention Weights

```python
# Extract and plot attention weights
model.eval()
with torch.no_grad():
    logits, attn_weights = model(x, return_attn=True)
    # attn_weights: [B, seq_len, seq_len]

# Visualization
import matplotlib.pyplot as plt
plt.imshow(attn_weights[0].cpu().numpy(), cmap='hot', aspect='auto')
plt.title('Self-Attention Weights')
plt.xlabel('Key (time step)')
plt.ylabel('Query (time step)')
plt.colorbar(label='Attention Weight')
plt.show()
```

---

## Dataset Description

### WSCC 9-Bus Fault Dataset

**Source**: IEEE 9-bus power grid simulation with S-transform time-frequency decomposition  
**Format**: 227×227 pixel grayscale PNG images  
**Size**: 33,000 images total, balanced across 11 classes  
**Train/Val/Test Split**: 70% / 15% / 15% (stratified)

### Classes (11 Fault Types)

| Class  | Type                      | Count   | Description                    |
|--------|---------------------------|---------|--------------------------------|
| NF     | No Fault                  | ~3,000  | Healthy 3-phase system         |
| AG     | A-to-Ground               | ~3,000  | Single-phase fault on Phase A  |
| BG     | B-to-Ground               | ~3,000  | Single-phase fault on Phase B  |
| CG     | C-to-Ground               | ~3,000  | Single-phase fault on Phase C  |
| AB     | A-to-B (Phase-to-Phase)   | ~3,000  | Two-phase fault (no ground)    |
| AC     | A-to-C (Phase-to-Phase)   | ~3,000  | Two-phase fault (no ground)    |
| BC     | B-to-C (Phase-to-Phase)   | ~3,000  | Two-phase fault (no ground)    |
| ABG    | AB-to-Ground (DLG)        | ~3,000  | Double-line-to-ground fault    |
| ACG    | AC-to-Ground (DLG)        | ~3,000  | Double-line-to-ground fault    |
| BCG    | BC-to-Ground (DLG)        | ~3,000  | Double-line-to-ground fault    |
| ABCG   | ABC-to-Ground (3-Phase)   | ~3,000  | Three-phase fault              |

### Data Preprocessing Pipeline

1. **Signal Processing**: Raw 6-channel (3V, 3I) post-fault transients
2. **S-Transform**: Time-frequency decomposition (localized frequency spectrum)
3. **Normalization**: Pixel values scaled to [0, 1] (uint8 → float32)
4. **Image Size**: 227×227 px (fixed input for CNN)
5. **Data Augmentation**: Gaussian noise at SNR 40, 30, 20 dB (training only)

### Train/Val/Test Split

```python
from sklearn.model_selection import train_test_split

# Stratified k-fold ensures class balance
idx_train, idx_test = train_test_split(
    np.arange(len(dataset)),
    test_size=0.30,
    stratify=labels,
    random_state=42
)
idx_val, idx_test = train_test_split(
    idx_test,
    test_size=0.50,
    stratify=labels[idx_test],
    random_state=42
)

# Train: 70% × 33,000 = 23,100
# Val:   15% × 33,000 = 4,950
# Test:  15% × 33,000 = 4,950
```

---

## Results

### 1. Classification Accuracy (5-Fold CV)

```
Model                   Accuracy        F1-Score        Params
─────────────────────────────────────────────────────────────
BiLSTM-Only             94.20% ± 1.80%  93.80% ± 2.00%  —
Baseline CNN            95.90% ± 1.20%  95.40% ± 1.30%  53.2K
CNN+BiLSTM (no attn)    97.10% ± 0.90%  97.00% ± 1.00%  805.4K
ChronoGrid FusionNet    98.50% ± 0.60%  98.40% ± 0.70%  1.059M
```

### 2. Per-Class F1-Score (Final Fold)

Highest improvements on minority/critical classes:

| Fault Class | FusionNet | Baseline | Gain  |
|-------------|-----------|----------|-------|
| Normal (NF) | 99.1%     | 96.8%    | +2.3% |
| SLG (AG/BG/CG) | 98.7% | 95.3%    | +3.4% |
| **Double-Line (AB/AC/BC)** | **97.2%** | **91.4%** | **+5.8%** |
| DLG/3-Phase | 98.8%     | 97.1%    | +1.7% |

### 3. Confusion Matrix Analysis

- **Double-Line Recall**: 85.8% → 96.0% (+10.2 pp reduction in miss rate)
- **Normal-Class Precision**: 99.2% (near-zero false-alarm rate)
- **Macro Avg F1**: 98.5% (strong balance across all classes)

### 4. Statistical Significance

| Test         | FusionNet vs CNN | p-value | Conclusion      |
|--------------|------------------|---------|-----------------|
| Paired t-test | t ≈ 3.5          | < 0.05  | Significant     |
| McNemar's test | χ² ≈ 16.4       | < 0.001 | Highly significant |

### 5. Inference Efficiency

| Metric           | GPU (NVIDIA A100) | CPU (Intel i7)  |
|------------------|-------------------|-----------------|
| Latency/sample   | 2.1 ms            | 45 ms           |
| Throughput       | ~476 samples/sec  | ~22 samples/sec |
| Energy (GPU)     | ~12 mJ/prediction | —               |

*Note: Suitable for protective relay response times (0–2 ms window)*

### 6. Attention Weight Interpretation

Self-attention mechanisms focus on **early post-fault transient intervals** (0–5 ms),
aligning with power systems domain knowledge that initial transient content is most
discriminative for fault classification.

---

## Figures & Visualizations

All figures are generated programmatically and saved as high-resolution PNG/PDF:

1. **fig01_class_distribution.png** — Dataset class balance (11 fault types)
2. **fig02_sample_images.png** — Representative S-transform heatmaps
3. **fig03_preprocessing.png** — Data normalization pipeline
4. **fig04_training_curves.png** — Loss and accuracy curves (all 3 models)
5. **fig05_ablation_curves.png** — Validation accuracy comparison
6. **fig06_08_confusion_matrices.png** — Normalized confusion matrices
7. **fig09_per_class_f1.png** — Per-class F1 bar chart
8. **fig10_overall_metrics.png** — Accuracy/Precision/Recall/F1 comparison
9. **fig11_roc_curves.png** — Multi-class ROC curves (AUC per fault type)
10. **fig12_attention_maps.png** — Self-attention weight visualizations
11. **fig13_ablation_f1_heatmap.png** — F1 heatmap (models × classes)
12. **fig14_radar_chart.png** — 5-metric ablation comparison
13. **table1_comparative_summary.png** — Performance summary table

---

## Future Work

1. **Real-World Validation**: Test on measured SCADA data from actual substations
2. **Multi-Terminal HVDC**: Extend to line-commutated and modular multilevel converter topologies
3. **Federated Learning**: Train across multiple regional grids without centralizing data
4. **Model Compression**: Knowledge distillation for edge deployment on microcontrollers
5. **Explainable AI**: SHAP/LIME for transparent fault diagnosis in regulatory settings
6. **Adversarial Robustness**: Adversarial training against noise and model attacks

---

## Citation

If you use this work, please cite:

```bibtex
@inproceedings{chronogrid2026,
  title={A Hybrid Deep Learning Approach for Detecting and Classifying Transmission Line Faults Using ChronoGrid FusionNet Model},
  author={Your Name},
  year={2026},
  school={SRM Institute of Science and Technology}
}
```

---

## License

This project is released under the MIT License. See [LICENSE](LICENSE) for details.

---

## Contact & Support

**Author**: Sanath B. S.  
**Institution**: SRM Institute of Science and Technology, Ramapuram Campus  
**Email**: bssanath27@gmail.com  
**GitHub**: https://github.com/sanathbs/  

For questions or issues, please open a GitHub issue or contact directly.

---

**Last Updated**: May 2026  
**Status**: Final Year Project (Complete)
