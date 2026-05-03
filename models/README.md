# ChronoGrid FusionNet — Trained Model Weights

Pre-trained model checkpoints for the ChronoGrid FusionNet architecture.

## Models

### CNN+BiLSTM (Fold 5)
- **File**: `CNN+BiLSTM_fold5.pt`
- **Accuracy**: 97.10% ± 0.90% (5-fold CV)
- **Parameters**: 805.4K
- **Input**: 227×227 S-transform spectrograms
- **Output**: 11 fault classes

### ChronoGrid FusionNet (Best Model)
- **File**: `chronogrid_fusionnet_fold5.pt`
- **Accuracy**: 98.50% ± 0.60% (5-fold CV)
- **F1-Score**: 98.40% ± 0.70%
- **Parameters**: 1.059M
- **Components**: Multi-scale CNN + BiLSTM + Self-Attention
- **Inference Latency**: 2.1 ms (GPU)

## Download Instructions

Models are automatically generated during training. To train locally:

```bash
cd ../notebooks
jupyter notebook main.ipynb
```

The notebook will:
1. Load WSCC 9-Bus dataset from local directory
2. Train all 4 model variants (ablation study)
3. Save checkpoints to ../models/
4. Generate cross-validation results and visualizations

## Model Architecture

### ChronoGrid FusionNet

```
Input [B, 227, 227]
    ↓
Multi-Scale CNN (k=3, k=5)
    ↓ [B, 256, 56]
Bidirectional LSTM (2 layers)
    ↓ [B, 56, 256]
Self-Attention (8 heads)
    ↓ [B, 56, 256]
Classification Head
    ↓ [B, 11]
Output: Fault Class Logits
```

## Usage in FastAPI Demo

```python
from pathlib import Path
import torch

# Load model
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = ChronoGridFusionNet(num_classes=11)
checkpoint = torch.load(
    "models/chronogrid_fusionnet_fold5.pt",
    map_location=device
)
model.load_state_dict(checkpoint)
model = model.to(device).eval()

# Inference
with torch.no_grad():
    output = model(x)  # [B, 11]
    probs = torch.softmax(output, dim=1)
    pred = probs.argmax(dim=1)
```

## Files

- `*.pt` — PyTorch model checkpoints (saved with `torch.save()`)
- `.gitignore` — Excludes large checkpoint files from git

## Dataset

The WSCC 9-Bus Fault Dataset (33,000 S-transform images) must be downloaded separately.
Place it in the project root as:

```
wscc9FaultDataset/
├── NF/      (No Fault)
├── AG/      (A-to-Ground)
├── BG/      (B-to-Ground)
├── ... (11 classes total)
```

## Training from Scratch

```bash
cd notebooks
jupyter notebook main.ipynb

# In notebook:
# 1. Mount dataset
# 2. Run all cells
# 3. Models saved to ../models/
```

## References

- Paper: ChronoGrid FusionNet — Hybrid Deep Learning for Transmission Line Fault Classification
- Author: Sanath B. S.
- Institution: SRM Institute of Science and Technology, Ramapuram Campus

**Last Updated**: May 2026
