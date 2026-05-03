# ChronoGrid FusionNet — Interactive Demo

Real-time transmission line fault classification web interface powered by PyTorch and FastAPI.

## Quick Start

```bash
# Install dependencies
make install

# Start FastAPI backend (port 8765)
make run-demo

# In another terminal, open browser:
# http://localhost:8765
```

## Features

✓ **Real-time Predictions** — Instant fault classification with confidence scores
✓ **Interactive Controls** — Select fault type, sample index, noise level
✓ **S-transform Visualization** — Canvas-based heatmap rendering with color gradients
✓ **Latency Tracking** — Live inference time display (GPU/CPU)
✓ **Probability Distribution** — Per-class prediction confidence bars
✓ **Responsive Design** — Dark theme, mobile-friendly interface

## Architecture

### Frontend (HTML5 + JavaScript)

**File**: `index.html`

- Fault type selector (11 classes: NF, AG, BG, CG, AB, AC, BC, ABG, ACG, BCG, ABCG)
- Sample index picker (1–3000 per class)
- Noise level slider (σ = 0.0–0.2)
- Canvas for S-transform visualization
- Real-time probability distribution chart
- Responsive grid layout with gradient styling

### Backend (FastAPI + PyTorch)

**File**: `../code/server.py`

```python
# Key endpoints
GET  /                    → Serve index.html
GET  /health             → Health check
POST /predict            → Inference endpoint
GET  /sample_count/{fault_type} → Class sample counts
```

**Inference Pipeline**:
1. Load fault class from request
2. Load S-transform image from disk
3. Add optional Gaussian noise
4. Preprocess: normalize to [0, 1], convert to PyTorch tensor
5. Forward pass through ChronoGrid FusionNet
6. Return: class prediction, probabilities, latency

## API Specification

### POST /predict

**Request**:
```json
{
  "fault_type": "ABG",
  "sample_index": 1234,
  "noise_sigma": 0.1
}
```

**Response**:
```json
{
  "predicted_class": "ABG",
  "confidence": 0.982,
  "probabilities": {
    "NF": 0.001,
    "AG": 0.002,
    ...,
    "ABG": 0.982
  },
  "latency_ms": 2.1
}
```

## Performance

| Metric | Value |
|--------|-------|
| Accuracy (5-fold CV) | 98.50% ± 0.60% |
| F1-Score | 98.40% ± 0.70% |
| Latency (GPU) | 2.1 ms |
| Latency (CPU) | 45 ms |
| Throughput (GPU) | ~476 samples/sec |
| Model Parameters | 1.059M |

## Troubleshooting

### Model not found error
```
Error: [Errno 2] No such file or directory: 'models/CNN+BiLSTM_fold5.pt'
```
**Fix**: Run training first: `jupyter notebook notebooks/main.ipynb`

### Dataset not found
```
Error: WSCC 9-Bus dataset not found at wscc9FaultDataset/
```
**Fix**: Download dataset to project root:
```
wscc9FaultDataset/
├── NF/
├── AG/
├── ... (11 classes)
```

### Port already in use
```
Error: Address already in use
```
**Fix**: Kill existing process or specify different port:
```bash
uvicorn code.server:app --host 127.0.0.1 --port 8000
```

## Development

### Run with debug logging
```bash
LOGLEVEL=debug uvicorn code.server:app --reload --host 127.0.0.1 --port 8765
```

### View server logs
```bash
tail -f server.log
```

### Test inference locally
```python
import torch
from code.server import model, load_and_preprocess, FAULT_CLASSES

x, _ = load_and_preprocess("ABG", 100, 0.0)
with torch.no_grad():
    output = model(x.unsqueeze(0))
    probs = torch.softmax(output, dim=1)
    pred = probs.argmax(dim=1).item()
    print(f"Predicted: {FAULT_CLASSES[pred]} ({probs[0, pred]:.1%})")
```

## Examples

### Example 1: Triple-Phase Fault (ABCG)
- Select "ABCG" from dropdown
- Pick sample 500
- Set noise σ = 0.0 (clean)
- Click "Predict" → Expected: ABCG with ~99% confidence

### Example 2: Noisy Double-Line Fault
- Select "ACG"
- Pick sample 1200
- Set noise σ = 0.15 (realistic measurement noise)
- Click "Predict" → Model should still classify correctly despite noise

### Example 3: Single-Phase Fault with Noise
- Select "BG"
- Pick sample 50
- Set noise σ = 0.2 (high noise)
- Click "Predict" → Confidence may decrease but classification should hold

## License

MIT License. See ../LICENSE for details.

## Citation

```bibtex
@inproceedings{chronogrid2026,
  title={A Hybrid Deep Learning Approach for Detecting and Classifying Transmission Line Faults Using ChronoGrid FusionNet Model},
  author={Sanath B. S.},
  year={2026},
  school={SRM Institute of Science and Technology}
}
```

---

**Last Updated**: May 2026  
**Status**: Production-Ready
