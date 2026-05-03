"""
ChronoGrid FusionNet Demo — FastAPI Backend
Serves real predictions from the CNN+BiLSTM model.
"""
import sys, os, random
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
state  = torch.load(MODEL_PATH, map_location=device, weights_only=False)
model.load_state_dict(state)
model.eval()
print(f"✓ Model loaded — {sum(p.numel() for p in model.parameters()):,} params")

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
    folder = DATASET_ROOT / fault_type
    files  = sorted(folder.glob("*.jpg"))
    if not files:
        raise HTTPException(404, f"No images for class {fault_type}")

    idx  = (sample_index - 1) % len(files)
    path = files[idx]

    img = Image.open(path).convert("L")
    arr = np.array(img, dtype=np.float32) / 255.0  # [227, 227]

    if noise_sigma > 0:
        arr = arr + np.random.normal(0, noise_sigma, arr.shape).astype(np.float32)
        arr = np.clip(arr, 0.0, 1.0)

    return arr, str(path)


def arr_to_tensor(arr: np.ndarray) -> torch.Tensor:
    return torch.tensor(arr).unsqueeze(0)  # [1, 227, 227]


def extract_heatmap_rows(arr: np.ndarray, n_rows: int = 32) -> list:
    """Return n_rows evenly-spaced rows of the heatmap for JS visualization."""
    step = max(1, IMG_SIZE // n_rows)
    rows = arr[::step][:n_rows]
    return rows.tolist()

# ─── Routes ───────────────────────────────────────────────────────────────────
@app.get("/")
def serve_ui():
    return FileResponse(DEMO_DIR / "index.html")


@app.get("/health")
def health():
    return {"status": "ok", "model": "CNN+BiLSTM_fold5", "classes": FAULT_CLASSES}


@app.post("/predict")
def predict(req: PredictRequest):
    if req.fault_type not in FAULT_CLASSES:
        raise HTTPException(400, f"Unknown fault type. Choose from {FAULT_CLASSES}")

    import time
    arr, img_path = load_and_preprocess(req.fault_type, req.sample_index, req.noise_sigma)
    x = arr_to_tensor(arr)

    t0 = time.perf_counter()
    with torch.no_grad():
        logits = model(x)                          # [1, 11]
        probs  = F.softmax(logits, dim=1)[0]       # [11]
    elapsed_ms = (time.perf_counter() - t0) * 1000

    pred_idx   = int(probs.argmax().item())
    pred_class = FAULT_CLASSES[pred_idx]
    confidence = float(probs[pred_idx].item())

    # Heatmap rows for visualization
    heatmap = extract_heatmap_rows(arr, n_rows=32)

    return {
        "predicted_class": pred_class,
        "predicted_index": pred_idx,
        "confidence": confidence,
        "probabilities": {c: float(probs[i].item()) for i, c in enumerate(FAULT_CLASSES)},
        "inference_ms": round(elapsed_ms, 2),
        "heatmap_rows": heatmap,           # 32×227 for JS rendering
        "image_path": img_path,
        "noise_applied": req.noise_sigma > 0,
    }


@app.get("/sample_count/{fault_type}")
def sample_count(fault_type: str):
    folder = DATASET_ROOT / fault_type
    count  = len(list(folder.glob("*.jpg")))
    return {"fault_type": fault_type, "count": count}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8765, reload=False)
