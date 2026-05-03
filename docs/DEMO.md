# 🚀 Live Demo — ChronoGrid FusionNet

Interactive web interface for real-time transmission line fault prediction.

## Quick Start

### Option 1: Using Makefile (Recommended)
```bash
make install-dev  # Install dependencies
make run-demo     # Start the server
```

Open your browser to: **http://localhost:8765**

### Option 2: Manual Setup
```bash
pip install -r requirements.txt
python -m code.server
```

The server will start on `http://0.0.0.0:8765`

## 🎮 Using the Demo

### Left Panel: Fault Prediction
1. **Select Fault Type**: Choose from 11 fault classes
   - NF (No Fault)
   - AG, BG, CG (Single-phase-to-ground)
   - AB, AC, BC (Phase-to-phase)
   - ABG, ACG, BCG (Double-line-to-ground)
   - ABCG (Three-phase-to-ground)

2. **Sample Index**: Pick a sample (1–3000) from the selected class
   - Each fault class has 3,000 samples
   - Samples are numbered 1–3000

3. **Noise Level**: Add Gaussian noise to simulate real-world conditions
   - 0.00 = Clean signal
   - 0.1 = Moderate noise
   - 0.2 = High noise (SNR ~20 dB)

4. **Click "Predict Fault"**: The model analyzes the S-transform heatmap

### Right Panel: Results
- **Predicted Fault**: The model's classification
- **Confidence**: Probability score (0–100%)
- **Inference Time**: Time taken (milliseconds)
- **Class Probabilities**: All 11 class scores
- **S-Transform Heatmap**: Visual time-frequency representation

## 🏗️ Architecture Overview

```
HTTP Request
    ↓
FastAPI Backend (Python)
    ├─ Load S-transform image
    ├─ Preprocess (normalize, add noise if requested)
    ├─ Run ChronoGrid FusionNet model (PyTorch)
    └─ Return predictions + visualization data
    ↓
JavaScript Frontend
    ├─ Display fault class & confidence
    ├─ Render S-transform heatmap (canvas)
    └─ Show per-class probabilities
```

## 📊 Demo Features

✅ **Real-Time Predictions** — <3ms inference latency (GPU)  
✅ **Interactive Interface** — Select faults, samples, noise levels  
✅ **Visualization** — S-transform heatmaps rendered in browser  
✅ **Responsive Design** — Works on desktop, tablet, mobile  
✅ **Dark Mode Ready** — Professional color scheme  

## 🔌 API Endpoints

### GET `/` 
Serves the demo interface (HTML)

### GET `/health`
Server health check
```json
{
  "status": "ok",
  "model": "CNN+BiLSTM_fold5",
  "classes": ["AG","BG","CG","AB","AC","BC","ABG","ACG","BCG","ABCG","NF"]
}
```

### POST `/predict`
Make a prediction

**Request:**
```json
{
  "fault_type": "ABG",
  "sample_index": 42,
  "noise_sigma": 0.05
}
```

**Response:**
```json
{
  "predicted_class": "ABG",
  "predicted_index": 7,
  "confidence": 0.987,
  "probabilities": {
    "AG": 0.001, "BG": 0.002, ..., "ABCG": 0.004
  },
  "inference_ms": 1.87,
  "heatmap_rows": [[...], [...], ...],
  "image_path": "/path/to/image.jpg",
  "noise_applied": true
}
```

### GET `/sample_count/{fault_type}`
Get available sample count for a fault type

**Response:**
```json
{
  "fault_type": "ABG",
  "count": 3000
}
```

## 📝 Understanding the Output

### Predicted Fault
The model's best guess for the fault class. With 98.50% accuracy, this is correct >98% of the time.

### Confidence Score
Probability assigned to the predicted class. Higher = more certain.
- 90–100%: High confidence (trust the prediction)
- 70–90%: Medium confidence (reasonable prediction)
- <70%: Low confidence (ambiguous case)

### S-Transform Heatmap
Visual representation of fault features:
- **X-axis**: Time (0–22.7 ms post-fault)
- **Y-axis**: Frequency (0–500 Hz)
- **Color**: Spectral magnitude (blue=low, red=high)
- **Key insight**: Different faults activate different frequency bands

### Class Probabilities
Confidence scores for all 11 fault types. Helps understand the model's decision-making:
- Top prediction usually has highest score
- Similar faults (e.g., DLG types) often have similar scores
- Low scores on dissimilar faults increase confidence

## 🧪 Example Scenarios

### Scenario 1: Clean Signal (Ideal Case)
```
Fault Type: ABG (AB-to-Ground)
Sample: 1
Noise: 0.00

Expected: Predicted class = ABG, Confidence >99%
```

### Scenario 2: Noisy Signal (Realistic)
```
Fault Type: BC (B-to-C Phase)
Sample: 500
Noise: 0.05 (moderate)

Expected: Predicted class = BC, Confidence 95–98%
```

### Scenario 3: Challenging Case
```
Fault Type: ABG (similar to DLG types)
Sample: 2000
Noise: 0.10 (high)

Expected: Predicted class = ABG (or ACG/BCG), Confidence 90–95%
```

## 🔧 Troubleshooting

### Server Won't Start
```bash
# Check if port 8765 is in use
lsof -i :8765

# Use different port
python -m code.server --port 9000
```

### Model Loading Fails
```bash
# Ensure model checkpoint exists
ls -la models/CNN+BiLSTM_fold5.pt

# Check PyTorch version
python -c "import torch; print(torch.__version__)"
```

### Heatmap Not Rendering
- Check browser console (F12 → Console tab)
- Ensure JavaScript is enabled
- Clear browser cache (Ctrl+Shift+Delete)

### Dataset Not Found
```bash
# Dataset must be at /path/to/wscc9FaultDataset/
ls -la wscc9FaultDataset/AG/  # Should show .jpg files
```

## 📊 Performance Metrics

| Metric | Value |
|--------|-------|
| **Accuracy** | 98.50% |
| **Latency** | 2.1 ms (GPU) / 45 ms (CPU) |
| **Max Throughput** | ~476 samples/sec (GPU) |
| **Model Size** | 1.059M parameters |
| **Required RAM** | ~2 GB |

## 🎯 Use Cases

1. **Interactive Learning**: Understand how faults are classified
2. **Model Validation**: Test predictions on known samples
3. **Research**: Analyze attention maps and feature importance
4. **Deployment Simulation**: Test production-like API interactions

## 📚 Documentation

- [Main README](./README.md) — Project overview
- [Technical Documentation](./TECHNICAL_DOCUMENTATION.md) — Architecture details
- [Dataset](./DATASET.md) — Data description

## 🔗 Links

- **GitHub**: https://github.com/Bsanath27/ieee-9bus-application
- **Paper**: ChronoGrid_FusionNet_Full_Paper.docx

---

**Happy Fault Detecting! ⚡**
