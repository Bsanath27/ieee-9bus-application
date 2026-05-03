================================================================================
PROJECT SUMMARY
================================================================================

Title: ChronoGrid FusionNet — Hybrid Deep Learning for Transmission Line Fault
       Classification

Institution: SRM Institute of Science and Technology, Ramapuram Campus
Final Year Project (Ongoing) — B.Tech Computer Science and Engineering

================================================================================
PROBLEM STATEMENT
================================================================================

Transmission line faults in interconnected power grids generate nonlinear
transient disturbances in voltage and current waveforms. Existing CNN-based
approaches operate on raw six-channel signals without handcrafted feature
engineering, but fail to:
  (1) Model long-range temporal dependencies inherent in sequential V-I patterns
  (2) Resolve classification ambiguity between closely related fault signatures
  (3) Maintain robustness under realistic noise conditions

Current methods achieve ~95–96% accuracy, leaving 4–14% miss rates on critical
fault classes (e.g., Double-Line faults that escalate to catastrophic DLG events),
unacceptable for power system protection relays operating at 0–2 ms response times.

================================================================================
OBJECTIVE
================================================================================

Develop a hybrid deep learning architecture (ChronoGrid FusionNet) that combines:
  • Multi-scale 1D CNN for localized transient feature extraction
  • Bidirectional LSTM for forward/backward temporal dependency modeling
  • Scaled dot-product self-attention for adaptive weighting of critical transient
    intervals

Goal: Exceed 98% accuracy on multi-class fault classification and improve
      minority-class (Double-Line) recall from 85.8% to >95%.

================================================================================
METHODOLOGY
================================================================================

1. DATA REPRESENTATION
   - Input: 227×227 S-transform spectrogram heatmaps (frequency vs. time)
   - Interpretation: Each heatmap row = frequency bin, column = time step
   - Dataset: WSCC 9-Bus Fault Dataset — 33,000 balanced S-transform images
   - Classes: 11 fault types (AG, BG, CG, AB, AC, BC, ABG, ACG, BCG, ABCG, NF)
   - Train/Val/Test: 70% / 15% / 15% stratified split

2. ARCHITECTURE
   a) CNN Backbone (shared across all models)
      - Multi-scale kernels (k=3, k=5) → 64 ch, ReLU, MaxPool
      - Progressive depth: 64 → 128 → 256 channels
      - Output: [B, 256, 56] (feature maps per time step)

   b) BiLSTM Layer
      - 2-layer LSTM, hidden=128, bidirectional → output=256 dim
      - Models temporal correlations in both directions

   c) Self-Attention
      - 8-head scaled dot-product attention (d_model=256)
      - Residual connection + LayerNorm
      - Assigns adaptive weights to important transient intervals

   d) Classification Head
      - Global average pooling over sequence
      - FC(256→128→11 classes) + Softmax

3. TRAINING
   - Optimizer: Adam (lr=0.001, weight_decay=1e-4)
   - Loss: Cross-entropy with label smoothing (ε=0.05)
   - Schedule: Cosine annealing LR, early stopping (patience=8)
   - Gradient clipping: max norm = 1.0
   - Data augmentation: Gaussian noise at SNR 40/30/20 dB

4. EVALUATION (Ablation Study)
   Three baseline models trained in same pipeline:

   Model          | Architecture                    | Params  | Accuracy
   ---------------+---------------------------------+---------+----------
   Baseline CNN   | 1D CNN only                     | 53.2K   | 95.90%
   CNN+BiLSTM     | CNN + BiLSTM (no attention)    | 805.4K  | 97.10%
   ChronoGrid FN  | CNN + BiLSTM + Self-Attention  | 1.059M  | 98.50%

   Cross-validation: 5-fold stratified CV with statistical significance tests
   (paired t-test, McNemar's test, p < 0.05)

================================================================================
CURRENT STATUS & RESULTS
================================================================================

Status: **COMPLETE** — All experiments conducted, paper drafted, implementation finalized

Key Findings:

Accuracy & Robustness
  • ChronoGrid FusionNet: 98.50% ± 0.60% (5-fold CV)
  • +2.60 pp gain over Baseline CNN
  • Monotonic improvement: BiLSTM-only (94.2%) → CNN (95.9%) → CNN+BiLSTM (97.1%) → FusionNet (98.5%)
  • Statistical significance: p < 0.01 vs all baselines (paired t-test, McNemar's test)

Critical Minority-Class Improvement
  • Double-Line fault recall: 85.8% → 96.0% (+10.2 pp)
  • DLG/3-Phase F1: 98.8% (vs 97.1% baseline)
  • Normal-class precision: 99.2% (false-fault rate near zero)

Per-Class F1 Scores (Test Set)
  Fault Type    | FusionNet | Baseline CNN | Gain
  ──────────────+-----------+--------------+------
  Normal (NF)   | 99.1%     | 96.8%        | +2.3pp
  SLG (AG/BG/CG)| 98.7%     | 95.3%        | +3.4pp
  Phase-to-Phase| 97.2%     | 91.4%        | +5.8pp
  DLG/3-Phase   | 98.8%     | 97.1%        | +1.7pp
  ─────────────────────────────────────────────
  Macro avg     | 98.5%     | 95.2%        | +3.3pp
  Weighted avg  | 98.4%     | 95.4%        | +3.0pp

Inference Efficiency
  • Latency: 2.1 ms/sample (GPU)
  • Parameters: 1.059M (vs 53.2K baseline)
  • Speed-accuracy tradeoff acceptable for protective relays (0–2 ms window)

Attention Mechanism Interpretability
  • Self-attention weight maps identify critical transient intervals
  • Visualization shows model focuses on early post-fault (0–5 ms) high-frequency content
  • Supports domain knowledge: transient analysis standard in power systems

Ablation Insights
  • CNN contribution: Kernel-3 (short spikes) + Kernel-5 (broad distortions) both necessary
  • BiLSTM contribution: +1.2 pp accuracy (long-range dependencies)
  • Attention contribution: +1.4 pp accuracy (resolves ambiguous cases)
  • All components statistically significant (p < 0.05)

================================================================================
TECHNOLOGIES & IMPLEMENTATION
================================================================================

Core ML Stack
  • PyTorch 2.0+ — Model implementation, training, evaluation
  • NumPy, SciPy — Numerical computing, signal processing
  • scikit-learn — Stratified CV, evaluation metrics, ROC/AUC
  • Matplotlib, Seaborn — IEEE-quality publication figures

Development Environment
  • Python 3.9+
  • GPU: CUDA-enabled (optional; CPU fallback supported)
  • Jupyter Notebook — Interactive experimentation and reproducibility
  • Version control: Git

Visualization & Publication
  • 14 publication-quality figures (IEEE style)
  • Confusion matrices, training curves, ablation comparisons, ROC curves,
    per-class F1, radar charts, attention weight maps
  • All figures generated programmatically; reproducible

Reproducibility
  • Fixed random seeds (NumPy, PyTorch, scikit-learn)
  • Stratified k-fold cross-validation (prevents data leakage)
  • No external model weights; all trained from scratch
  • Hyperparameter documented in notebook

================================================================================
LINKS
================================================================================

GitHub Repository (with full code, data loader, figures)
  https://github.com/sanathbs/IEEE-9bus-ChronoGrid-FusionNet

  Includes:
    • chronogrid_fusionnet.ipynb — Complete implementation
    • Dataset loader and preprocessing pipeline
    • All 14 publication-quality figures
    • Model checkpoints and ablation results
    • Replication instructions

Dataset
  WSCC 9-Bus Fault Dataset — Publicly available
  Source: IEEE 9-bus power grid simulation with S-transform preprocessing
  Size: 33,000 images × 227×227 px, 11 fault classes, balanced

Research Paper
  ChronoGrid_FusionNet_Full_Paper.pdf
  [To be submitted to conference/journal]

================================================================================
DELIVERABLES
================================================================================

✓ Fully trained ChronoGrid FusionNet model (state_dict checkpoint)
✓ Complete ablation study (3 baselines, 5-fold CV, statistical tests)
✓ 14 publication-quality figures (confusion matrices, curves, attention maps)
✓ Comprehensive Jupyter notebook with reproducible code
✓ Classification report, per-class metrics, inference benchmarks
✓ Interactive demo (React + TypeScript frontend for real-time fault prediction)

Estimated Project Completion: May 2026 (thesis submission)

================================================================================
