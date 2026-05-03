================================================================================
RESEARCH ABSTRACT
================================================================================

Title: A Hybrid Deep Learning Approach for Detecting and Classifying Transmission
       Line Faults Using ChronoGrid FusionNet Model

================================================================================

Transmission line faults in electrical power grids present critical challenges
to system stability and reliability. Asymmetrical faults (single-phase-to-ground,
phase-to-phase, and multi-phase-to-ground) induce nonlinear transient
disturbances in voltage and current waveforms. Existing CNN-based approaches
process raw signals without handcrafted feature engineering but lack: (1)
long-range temporal dependency modeling, and (2) adaptive mechanisms to
disambiguate closely related fault signatures.

We propose ChronoGrid FusionNet, a hybrid architecture integrating three
sequential components: (i) Multi-scale 1D Convolutional Neural Network with
kernel sizes 3 and 5 for extracting localized transient features; (ii)
Bidirectional Long Short-Term Memory networks for modeling forward and backward
temporal correlations; and (iii) Scaled dot-product self-attention mechanism
with 8 heads to assign adaptive weights to critical transient intervals.

Evaluated via five-fold stratified cross-validation on the WSCC 9-Bus fault
dataset (33,000 S-transform spectrogram images, 11 fault classes), the proposed
model achieves 98.50% ± 0.60% accuracy and 98.40% ± 0.70% macro F1-score,
significantly outperforming three ablation baselines: Baseline CNN (95.90%),
CNN+BiLSTM without attention (97.10%), and BiLSTM-only (94.20%).

Critical improvements include: Double-Line fault recall increased from 85.8% to
96.0% (+10.2 percentage points), and near-perfect Normal-class precision
(99.2%), eliminating dangerous false-alarm rates. Statistical significance is
confirmed via paired t-test (p < 0.01) and McNemar's test. Ablation analysis
quantifies each component's independent contribution: CNN provides baseline
feature extraction; BiLSTM adds +1.2 pp accuracy through temporal modeling;
attention adds +1.4 pp through adaptive weighting. The model achieves 2.1 ms
inference latency on GPU, suitable for protective relay response times (0–2 ms).

This work bridges the gap between localized feature extraction and adaptive
long-range dependency modeling, advancing the state-of-the-art in hybrid deep
learning for critical infrastructure protection.

Keywords: Transmission line fault detection, ChronoGrid FusionNet, Bidirectional
LSTM, Multi-Head Self-Attention, S-transform spectrograms, Smart grid protection

================================================================================
