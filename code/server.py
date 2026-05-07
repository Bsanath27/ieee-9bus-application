"""
ChronoGrid FusionNet Demo — FastAPI Backend
Serves predictions from CNN+BiLSTM or mock demo mode if model/dataset unavailable.
"""
import sys, os, random, time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

# ─── Paths ────────────────────────────────────────────────────────────────────
ROOT         = Path(__file__).parent.parent
MODEL_PATH   = ROOT / "models" / "CNN+BiLSTM_fold5.pt"
DATASET_ROOT = ROOT / "wscc9FaultDataset"
DEMO_DIR     = Path(__file__).parent

# ─── Constants ────────────────────────────────────────────────────────────────
FAULT_CLASSES = ['AG','BG','CG','AB','AC','BC','ABG','ACG','BCG','ABCG','NF']
IMG_SIZE      = 227

# ─── Model Definition ────────────────────────────────────────────────────────
class CNNBiLSTM(nn.Module):
    def __init__(self, num_classes=11):
        super().__init__()
        self.cnn = nn.Sequential(
            nn.Conv1d(IMG_SIZE, 64, kernel_size=3, padding=1),
            nn.BatchNorm1d(64), nn.ReLU(),
            nn.Conv1d(64, 128, kernel_size=5, padding=2),
            nn.BatchNorm1d(128), nn.ReLU(), nn.MaxPool1d(2),
            nn.Conv1d(128, 256, kernel_size=3, padding=1),
            nn.BatchNorm1d(256), nn.ReLU(), nn.MaxPool1d(2),
        )
        self.bilstm = nn.LSTM(256, 128, num_layers=2, batch_first=True,
                              bidirectional=True, dropout=0.3)
        self.head = nn.Sequential(
            nn.Dropout(0.3),
            nn.Linear(256, 128), nn.ReLU(),
            nn.Linear(128, num_classes),
        )

    def forward(self, x):
        x = self.cnn(x).permute(0, 2, 1)   # [B, 56, 256]
        x, _ = self.bilstm(x)               # [B, 56, 256]
        x = x.mean(dim=1)                   # [B, 256]
        return self.head(x)

# ─── Load Model ───────────────────────────────────────────────────────────────
device = torch.device("cpu")
model  = CNNBiLSTM()
model_loaded = False

if MODEL_PATH.exists():
    try:
        state  = torch.load(MODEL_PATH, map_location=device, weights_only=False)
        model.load_state_dict(state)
        model_loaded = True
        print(f"✓ Model loaded — {sum(p.numel() for p in model.parameters()):,} params")
    except Exception as e:
        print(f"⚠ Model loading failed: {e}")
        print("Running in DEMO MODE (using mock predictions)")
else:
    print(f"⚠ Model file not found: {MODEL_PATH}")
    print("Running in DEMO MODE (using mock predictions)")

model.eval()

# Check dataset
dataset_exists = DATASET_ROOT.exists() and len(list(DATASET_ROOT.glob("*/"))) > 0
if not dataset_exists:
    print(f"⚠ Dataset not found at {DATASET_ROOT}")
    print("Demo will use synthetic spectrograms")

# ─── Synthetic S-Transform Generator ──────────────────────────────────────────
def generate_synthetic_spectrogram(fault_type: str, seed: int = None) -> np.ndarray:
    """Generate realistic synthetic S-transform spectrogram for demo mode."""
    if seed is not None:
        np.random.seed(seed)

    # Base spectrogram: low energy
    arr = np.random.randn(IMG_SIZE, IMG_SIZE) * 0.3 + 0.2
    arr = np.clip(arr, 0, 1)

    # Add transient burst based on fault type
    fault_patterns = {
        'NF':    {'mag': 0.3, 'cols': (20, 80)},    # No fault: baseline
        'AG':    {'mag': 0.8, 'cols': (30, 120)},   # Single-phase: moderate
        'BG':    {'mag': 0.8, 'cols': (30, 120)},
        'CG':    {'mag': 0.8, 'cols': (30, 120)},
        'AB':    {'mag': 0.9, 'cols': (25, 130)},   # Phase-phase: strong
        'AC':    {'mag': 0.9, 'cols': (25, 130)},
        'BC':    {'mag': 0.9, 'cols': (25, 130)},
        'ABG':   {'mag': 0.95, 'cols': (20, 140)},  # Double: very strong
        'ACG':   {'mag': 0.95, 'cols': (20, 140)},
        'BCG':   {'mag': 0.95, 'cols': (20, 140)},
        'ABCG':  {'mag': 1.0, 'cols': (15, 150)},   # Triple: maximum
    }

    pattern = fault_patterns.get(fault_type, fault_patterns['NF'])
    col_start, col_end = pattern['cols']
    mag = pattern['mag']

    # Add high-frequency content in fault window
    fault_window = np.random.randn(IMG_SIZE, col_end - col_start) * mag + mag * 0.5
    fault_window = np.clip(fault_window, 0, 1)

    # Place transient
    arr[:, col_start:col_end] = arr[:, col_start:col_end] * 0.3 + fault_window * 0.7

    return np.clip(arr, 0, 1)

# ─── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(title="ChronoGrid FusionNet Demo")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

# ─── Request schema ───────────────────────────────────────────────────────────
class PredictRequest(BaseModel):
    fault_type: str   # one of FAULT_CLASSES
    noise_sigma: float = 0.0
    sample_index: int = 1  # 1-based

# ─── Inference helper ─────────────────────────────────────────────────────────
def load_and_preprocess(fault_type: str, sample_index: int, noise_sigma: float):
    """Load real or synthetic spectrogram based on dataset availability."""

    # Try real dataset first
    if dataset_exists:
        folder = DATASET_ROOT / fault_type
        files  = sorted(folder.glob("*.jpg"))
        if files:
            idx  = (sample_index - 1) % len(files)
            path = files[idx]
            img = Image.open(path).convert("L")
            arr = np.array(img, dtype=np.float32) / 255.0  # [227, 227]
            img_source = f"Real: {path.name}"
        else:
            # Fallback to synthetic
            arr = generate_synthetic_spectrogram(fault_type, seed=sample_index)
            img_source = f"Synthetic (no real data)"
    else:
        # Use synthetic spectrogram
        arr = generate_synthetic_spectrogram(fault_type, seed=sample_index)
        img_source = "Synthetic (dataset not found)"

    # Add noise if requested
    if noise_sigma > 0:
        arr = arr + np.random.normal(0, noise_sigma, arr.shape).astype(np.float32)
        arr = np.clip(arr, 0.0, 1.0)

    return arr, img_source


def arr_to_tensor(arr: np.ndarray) -> torch.Tensor:
    return torch.tensor(arr).unsqueeze(0)  # [1, 227, 227]


def extract_heatmap_rows(arr: np.ndarray, n_rows: int = 32) -> list:
    """Return n_rows evenly-spaced rows of the heatmap for JS visualization."""
    step = max(1, IMG_SIZE // n_rows)
    rows = arr[::step][:n_rows]
    return rows.tolist()


def generate_mock_prediction(fault_type: str, noise_sigma: float) -> dict:
    """Generate realistic mock predictions when model isn't loaded."""
    # Base confidence based on class
    base_confs = {
        'NF': 0.98, 'AG': 0.96, 'BG': 0.96, 'CG': 0.96,
        'AB': 0.95, 'AC': 0.95, 'BC': 0.95,
        'ABG': 0.97, 'ACG': 0.97, 'BCG': 0.97, 'ABCG': 0.98
    }

    true_conf = base_confs.get(fault_type, 0.92)

    # Decrease confidence with noise
    if noise_sigma > 0:
        true_conf = max(0.50, true_conf - noise_sigma * 0.3)

    # Generate probabilities (Dirichlet-like)
    probs = np.random.dirichlet(np.ones(11) * 0.5)

    # Boost the true class
    probs[FAULT_CLASSES.index(fault_type)] = true_conf
    probs = probs / probs.sum()  # Renormalize

    return {
        class_name: float(probs[i])
        for i, class_name in enumerate(FAULT_CLASSES)
    }

# ─── Routes ───────────────────────────────────────────────────────────────────
@app.get("/")
def serve_ui():
    return FileResponse(DEMO_DIR / "index.html")


@app.get("/health")
def health():
    mode = "Real (model + dataset)" if (model_loaded and dataset_exists) else "Demo (synthetic)"
    return {
        "status": "ok",
        "mode": mode,
        "model_loaded": model_loaded,
        "dataset_available": dataset_exists,
        "classes": FAULT_CLASSES
    }


@app.post("/predict")
def predict(req: PredictRequest):
    try:
        if req.fault_type not in FAULT_CLASSES:
            raise HTTPException(400, f"Unknown fault type. Choose from {FAULT_CLASSES}")

        arr, img_source = load_and_preprocess(req.fault_type, req.sample_index, req.noise_sigma)
        x = arr_to_tensor(arr)
    except Exception as e:
        print(f"❌ Predict error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Prediction error: {str(e)}")

    try:
        # Generate predictions
        if model_loaded:
            # Use actual model
            t0 = time.perf_counter()
            with torch.no_grad():
                logits = model(x)                          # [1, 11]
                probs  = F.softmax(logits, dim=1)[0]       # [11]
            elapsed_ms = (time.perf_counter() - t0) * 1000

            pred_idx   = int(probs.argmax().item())
            pred_class = FAULT_CLASSES[pred_idx]
            confidence = float(probs[pred_idx].item())
            probs_dict = {c: float(probs[i].item()) for i, c in enumerate(FAULT_CLASSES)}
        else:
            # Use mock predictions
            elapsed_ms = np.random.uniform(1.5, 3.0)  # Simulate latency
            probs_dict = generate_mock_prediction(req.fault_type, req.noise_sigma)
            pred_class = max(probs_dict, key=probs_dict.get)
            pred_idx = FAULT_CLASSES.index(pred_class)
            confidence = probs_dict[pred_class]

        # Heatmap rows for visualization
        heatmap = extract_heatmap_rows(arr, n_rows=32)

        return {
            "predicted_class": pred_class,
            "predicted_index": pred_idx,
            "confidence": confidence,
            "probabilities": probs_dict,
            "inference_ms": round(elapsed_ms, 2),
            "heatmap_rows": heatmap,           # 32×227 for JS rendering
            "image_source": img_source,
            "noise_applied": req.noise_sigma > 0,
            "demo_mode": not model_loaded,
        }
    except Exception as e:
        print(f"❌ Predict processing error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Processing error: {str(e)}")


@app.get("/sample_count/{fault_type}")
def sample_count(fault_type: str):
    if fault_type not in FAULT_CLASSES:
        raise HTTPException(400, f"Unknown fault type: {fault_type}")

    if dataset_exists:
        folder = DATASET_ROOT / fault_type
        count  = len(list(folder.glob("*.jpg")))
    else:
        count  = 3000  # Default count per class in real dataset

    return {"fault_type": fault_type, "count": count}


if __name__ == "__main__":
    import os
    import uvicorn
    port = int(os.environ.get("PORT", 8765))
    host = os.environ.get("HOST", "0.0.0.0")
    uvicorn.run(app, host=host, port=port, reload=False)
