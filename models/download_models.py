#!/usr/bin/env python3
"""
Download pre-trained ChronoGrid FusionNet model weights.

Usage:
    python download_models.py          # Download all models
    python download_models.py --model chronogrid_fusionnet_fold5
"""

import os
import sys
import urllib.request
from pathlib import Path

# Models: {filename: (url, size_mb, description)}
MODELS = {
    "chronogrid_fusionnet_fold5.pt": {
        "url": "https://github.com/Bsanath27/ieee-9bus-application/releases/download/v1.0/chronogrid_fusionnet_fold5.pt",
        "size_mb": 12.5,
        "description": "ChronoGrid FusionNet (Best Model) - 98.50% accuracy, 1.059M params"
    },
    "CNN+BiLSTM_fold5.pt": {
        "url": "https://github.com/Bsanath27/ieee-9bus-application/releases/download/v1.0/CNN+BiLSTM_fold5.pt",
        "size_mb": 8.2,
        "description": "CNN+BiLSTM Baseline - 97.10% accuracy, 805.4K params"
    }
}

def download_file(url, filepath, size_mb):
    """Download file with progress bar."""
    print(f"Downloading {filepath} ({size_mb} MB)...")
    try:
        urllib.request.urlretrieve(url, filepath)
        print(f"✓ {filepath} saved")
        return True
    except Exception as e:
        print(f"✗ Error downloading {filepath}: {e}")
        return False

def main():
    model_dir = Path(__file__).parent
    models_to_download = [m for m in MODELS.keys()]
    
    if len(sys.argv) > 1 and sys.argv[1] == "--model":
        if len(sys.argv) < 3:
            print("Usage: python download_models.py --model <model_name>")
            sys.exit(1)
        models_to_download = [sys.argv[2] + ".pt"] if not sys.argv[2].endswith(".pt") else [sys.argv[2]]
    
    print("=" * 70)
    print("ChronoGrid FusionNet — Model Download")
    print("=" * 70)
    
    success_count = 0
    for model_name in models_to_download:
        if model_name not in MODELS:
            print(f"✗ Unknown model: {model_name}")
            continue
        
        info = MODELS[model_name]
        filepath = model_dir / model_name
        
        if filepath.exists():
            print(f"✓ {model_name} already exists (skip)")
            success_count += 1
            continue
        
        print(f"\n{info['description']}")
        if download_file(info['url'], str(filepath), info['size_mb']):
            success_count += 1
    
    print("\n" + "=" * 70)
    print(f"Downloaded {success_count}/{len(models_to_download)} models")
    print("=" * 70)
    
    if success_count == len(models_to_download):
        print("\n✓ All models ready!")
        print("\nRun demo:")
        print("  cd ..")
        print("  make run-demo")
    else:
        print("\n✗ Some models failed to download. Check errors above.")
        sys.exit(1)

if __name__ == "__main__":
    main()
