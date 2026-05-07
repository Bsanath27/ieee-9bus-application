"""
ChronoGrid FusionNet Demo — FastAPI Backend
Real inference from CNN+BiLSTM_fold5.pt
"""
import asyncio, base64, io, os, random, time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sklearn.metrics import f1_score, confusion_matrix as sk_confusion_matrix

# ─── Paths ────────────────────────────────────────────────────────────────────
ROOT         = Path(__file__).parent
MODEL_PATH   = Path(os.environ.get("MODEL_PATH", ROOT / "CNN+BiLSTM_fold5.pt"))
DATASET_ROOT = Path(os.environ.get("DATASET_ROOT", ROOT / "samples"))

# ─── Constants ────────────────────────────────────────────────────────────────
FAULT_CLASSES = ['AG','BG','CG','AB','AC','BC','ABG','ACG','BCG','ABCG','NF']
IMG_SIZE      = 227
EVAL_SAMPLES  = 50  # samples per class for metrics computation

# ─── Model ────────────────────────────────────────────────────────────────────
class CNNBiLSTM(nn.Module):
    def __init__(self, num_classes: int = 11):
        super().__init__()
        self.cnn = nn.Sequential(
            nn.Conv1d(IMG_SIZE, 64,  kernel_size=3, padding=1),
            nn.BatchNorm1d(64),  nn.ReLU(),
            nn.Conv1d(64,  128, kernel_size=5, padding=2),
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

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.cnn(x).permute(0, 2, 1)
        x, _ = self.bilstm(x)
        x = x.mean(dim=1)
        return self.head(x)

device = torch.device("cpu")
model  = CNNBiLSTM()
model.load_state_dict(torch.load(MODEL_PATH, map_location=device, weights_only=False))
model.eval()
print(f"✓ CNN+BiLSTM loaded — {sum(p.numel() for p in model.parameters()):,} params")

# ─── Cached metrics ───────────────────────────────────────────────────────────
_metrics: dict = {"ready": False}

# ─── Helpers ──────────────────────────────────────────────────────────────────
def pil_to_tensor(img: Image.Image) -> torch.Tensor:
    img = img.convert("L").resize((IMG_SIZE, IMG_SIZE), Image.LANCZOS)
    arr = np.array(img, dtype=np.float32) / 255.0
    return torch.tensor(arr).unsqueeze(0)          # [1, 227, 227]


def run_inference(tensor: torch.Tensor) -> dict:
    t0 = time.perf_counter()
    with torch.no_grad():
        logits = model(tensor)
        probs  = F.softmax(logits, dim=1)[0]
    elapsed_ms = (time.perf_counter() - t0) * 1000

    pred_idx = int(probs.argmax().item())
    return {
        "predicted_class": FAULT_CLASSES[pred_idx],
        "predicted_index": pred_idx,
        "confidence":      float(probs[pred_idx].item()),
        "probabilities":   {c: float(probs[i].item()) for i, c in enumerate(FAULT_CLASSES)},
        "inference_ms":    round(elapsed_ms, 2),
        "noise_applied":   False,
    }


def img_to_base64(path: Path) -> str:
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode()


def extract_heatmap_rows(arr: np.ndarray, n: int = 32) -> list:
    step = max(1, IMG_SIZE // n)
    return arr[::step][:n].tolist()


def get_class_files(fault_type: str) -> list[Path]:
    folder = DATASET_ROOT / fault_type
    if not folder.exists():
        raise HTTPException(404, f"Class folder not found: {fault_type}")
    return sorted(folder.glob("*.jpg"))

# ─── App ──────────────────────────────────────────────────────────────────────
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(_app: FastAPI):
    asyncio.create_task(_eval_loop())
    yield

app = FastAPI(title="ChronoGrid FusionNet API", version="2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

async def _eval_loop():
    if not DATASET_ROOT.exists():
        print("⚠ Dataset not found — metrics endpoint will return ready=false")
        return
    print("⏳ Computing per-class metrics (50 samples/class)…")
    all_preds, all_labels = [], []
    per_class_acc: dict[str, float] = {}
    latencies: list[float] = []

    for cls_idx, cls in enumerate(FAULT_CLASSES):
        files  = get_class_files(cls)
        sample = random.sample(files, min(EVAL_SAMPLES, len(files)))
        correct = 0
        for path in sample:
            img = Image.open(path)
            tensor = pil_to_tensor(img)
            res = run_inference(tensor)
            latencies.append(res["inference_ms"])
            pred = res["predicted_class"]
            all_preds.append(FAULT_CLASSES.index(pred))
            all_labels.append(cls_idx)
            if pred == cls:
                correct += 1
            await asyncio.sleep(0)  # yield to event loop

        per_class_acc[cls] = correct / len(sample)

    macro_acc = sum(per_class_acc.values()) / len(per_class_acc)
    macro_f1  = float(f1_score(all_labels, all_preds, average="macro"))
    cm        = sk_confusion_matrix(all_labels, all_preds, labels=list(range(11))).tolist()

    _metrics.update({
        "ready":              True,
        "per_class_accuracy": per_class_acc,
        "macro_accuracy":     macro_acc,
        "macro_f1":           macro_f1,
        "latency_ms":         sum(latencies) / len(latencies),
        "params":             sum(p.numel() for p in model.parameters()),
        "baseline_accuracy":  None,
        "baseline_f1":        None,
        "confusion_matrix":   cm,
    })
    print(f"✓ Metrics ready — macro acc: {macro_acc*100:.1f}%  macro F1: {macro_f1*100:.1f}%")

# ─── Routes ───────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status":        "ok",
        "model":         "CNN+BiLSTM_fold5",
        "classes":       FAULT_CLASSES,
        "metrics_ready": _metrics.get("ready", False),
    }


@app.post("/predict/upload")
async def predict_upload(file: UploadFile = File(...)):
    if file.content_type not in ("image/jpeg", "image/jpg"):
        raise HTTPException(400, "Only JPEG images are accepted.")
    data   = await file.read()
    img    = Image.open(io.BytesIO(data))
    tensor = pil_to_tensor(img)
    arr    = np.array(img.convert("L").resize((IMG_SIZE, IMG_SIZE), Image.LANCZOS),
                      dtype=np.float32) / 255.0
    res = run_inference(tensor)
    res["heatmap_rows"] = extract_heatmap_rows(arr)
    res["image_path"]   = file.filename or "uploaded"
    return res


@app.get("/samples/{fault_type}/random")
def get_random_sample(fault_type: str):
    if fault_type not in FAULT_CLASSES:
        raise HTTPException(400, f"Unknown fault type: {fault_type}")
    files  = get_class_files(fault_type)
    path   = random.choice(files)
    img    = Image.open(path)
    tensor = pil_to_tensor(img)
    arr    = np.array(img.convert("L").resize((IMG_SIZE, IMG_SIZE), Image.LANCZOS),
                      dtype=np.float32) / 255.0
    res = run_inference(tensor)
    res["heatmap_rows"]  = extract_heatmap_rows(arr)
    res["image_path"]    = str(path)
    res["image_base64"]  = img_to_base64(path)
    res["fault_type"]    = fault_type
    return res


@app.get("/dataset/{fault_type}/{filename}")
def serve_dataset_image(fault_type: str, filename: str):
    if fault_type not in FAULT_CLASSES:
        raise HTTPException(400, f"Unknown fault type: {fault_type}")
    path = DATASET_ROOT / fault_type / filename
    if not path.exists():
        raise HTTPException(404, "Image not found")
    return FileResponse(str(path), media_type="image/jpeg")


@app.get("/metrics")
def get_metrics():
    return _metrics


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8765, reload=False)
