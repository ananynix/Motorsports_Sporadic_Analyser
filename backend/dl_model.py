import os
import json
import glob
import random
import copy
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader

MODEL_DIR = os.path.join(os.path.dirname(__file__), 'models')
MODEL_PATH = os.path.join(MODEL_DIR, 'telemetry_tcn.pth')
HISTORICAL_GLOB = os.path.join(os.path.dirname(__file__), 'data', 'historical', '*', '*', 'R', '*.json')
FALLBACK_JSON = os.path.join(os.path.dirname(__file__), 'belgium_gp_telemetry.json')

# tire_temp_fl/fr and x/y are deliberately excluded: FastF1's public API
# doesn't expose real tire temperature (every point in every real season
# file has tire_temp_fl == tire_temp_fr == 100.0, a hardcoded constant --
# training a model to predict a constant is a degenerate, meaningless
# learning problem), and x/y position isn't the "car performance/stress"
# signal this predictor is for. These four are real and meaningfully
# varying in every data source this project has.
FEATURES = ["speed", "rpm", "throttle", "brake_pressure"]


def load_season_dataset():
    """
    Loads every real per-driver lap file produced by
    download_historical_season.py (Phase 5), one point-list per lap. Falls
    back to the single-lap Belgium GP demo fixture -- with a loud warning --
    if no historical data has been downloaded in this environment, so
    training never hard-fails, but nobody mistakes that reduced-quality run
    for the real, season-scale one.
    """
    files = sorted(glob.glob(HISTORICAL_GLOB))
    if not files:
        print(f"WARNING: No historical season data found at {HISTORICAL_GLOB}. "
              f"Falling back to the single-lap {FALLBACK_JSON} -- run "
              f"backend/download_historical_season.py first for a real, "
              f"season-scale training run.")
        if not os.path.exists(FALLBACK_JSON):
            raise FileNotFoundError(f"Neither historical season data nor {FALLBACK_JSON} found.")
        with open(FALLBACK_JSON) as f:
            return [json.load(f)]

    laps = []
    for path in files:
        with open(path) as f:
            laps.append(json.load(f))
    print(f"Loaded {len(laps)} real laps ({sum(len(l) for l in laps)} points) "
          f"from {os.path.dirname(os.path.dirname(os.path.dirname(HISTORICAL_GLOB)))}")
    return laps


class TelemetryDataset(Dataset):
    """
    Builds sliding-window (x, y) pairs independently within each lap -- never
    spanning two different laps/drivers/races, which would otherwise create
    nonsensical training pairs at lap boundaries. Pass train-split mean/std
    for BOTH the train and val datasets (never compute val's own stats --
    that would leak validation distribution info into how the model sees
    its normalized inputs).
    """
    def __init__(self, laps, seq_length=20, pred_length=10, mean=None, std=None):
        self.seq_length = seq_length
        self.pred_length = pred_length
        features, targets = [], []

        for lap in laps:
            for i in range(len(lap) - seq_length - pred_length):
                seq = lap[i: i + seq_length]
                pred = lap[i + seq_length: i + seq_length + pred_length]
                features.append([[d[f] for f in FEATURES] for d in seq])
                targets.append([[d[f] for f in FEATURES] for d in pred])

        self.features = torch.tensor(features, dtype=torch.float32)
        self.targets = torch.tensor(targets, dtype=torch.float32)

        if mean is None or std is None:
            self.mean = self.features.mean(dim=(0, 1), keepdim=True)
            self.std = self.features.std(dim=(0, 1), keepdim=True) + 1e-5
        else:
            self.mean = mean
            self.std = std

        self.features = (self.features - self.mean) / self.std

    def __len__(self):
        return len(self.features)

    def __getitem__(self, idx):
        return self.features[idx], self.targets[idx]


class _TCNBlock(nn.Module):
    """
    One causal dilated residual block: two Conv1d layers, each followed by a
    'chomp' that trims the trailing padding off the output so every position
    only ever depends on current and past timesteps -- that's what makes
    this causal, not just convolutional.
    """
    def __init__(self, in_channels, out_channels, kernel_size, dilation, dropout=0.2):
        super().__init__()
        self.padding = (kernel_size - 1) * dilation
        self.conv1 = nn.Conv1d(in_channels, out_channels, kernel_size, padding=self.padding, dilation=dilation)
        self.conv2 = nn.Conv1d(out_channels, out_channels, kernel_size, padding=self.padding, dilation=dilation)
        self.relu = nn.ReLU()
        self.dropout = nn.Dropout(dropout)
        self.downsample = nn.Conv1d(in_channels, out_channels, 1) if in_channels != out_channels else None

    def _chomp(self, x):
        return x[:, :, :-self.padding] if self.padding else x

    def forward(self, x):
        out = self.dropout(self.relu(self._chomp(self.conv1(x))))
        out = self.dropout(self.relu(self._chomp(self.conv2(out))))
        residual = x if self.downsample is None else self.downsample(x)
        return self.relu(out + residual)


class TelemetryTCN(nn.Module):
    """
    Temporal Convolutional Network: stacked causal dilated Conv1d residual
    blocks instead of a recurrent LSTM. Dilations double each level (1, 2, 4),
    giving a receptive field that comfortably covers the seq_length=20 input
    window with kernel_size=3. Parallelizable over the time axis at train
    time (unlike an RNN's sequential dependency) and a well-established LSTM
    alternative for multi-step time-series forecasting (Bai et al., 2018,
    "An Empirical Evaluation of Generic Convolutional and Recurrent Networks
    for Sequence Modeling").
    """
    def __init__(self, input_size=len(FEATURES), hidden_size=64, output_size=len(FEATURES),
                 pred_length=10, num_levels=3, kernel_size=3, dropout=0.2):
        super().__init__()
        self.pred_length = pred_length
        self.output_size = output_size

        layers = []
        in_channels = input_size
        for level in range(num_levels):
            dilation = 2 ** level
            layers.append(_TCNBlock(in_channels, hidden_size, kernel_size, dilation, dropout))
            in_channels = hidden_size
        self.tcn = nn.Sequential(*layers)
        self.fc = nn.Linear(hidden_size, pred_length * output_size)

    def forward(self, x):
        # x: (batch, seq_len, features) -> Conv1d wants (batch, features, seq_len)
        x = x.transpose(1, 2)
        out = self.tcn(x)
        out = out[:, :, -1]  # last timestep, whose receptive field covers the whole window
        out = self.fc(out)
        return out.view(x.size(0), self.pred_length, self.output_size)


def train_model():
    laps = load_season_dataset()

    random.seed(42)
    shuffled = laps[:]
    random.shuffle(shuffled)
    split_idx = max(1, int(len(shuffled) * 0.85))
    train_laps, val_laps = shuffled[:split_idx], shuffled[split_idx:]
    if not val_laps:  # e.g. the single-lap fallback -- nothing to hold out
        val_laps = train_laps

    seq_length, pred_length = 20, 10
    train_dataset = TelemetryDataset(train_laps, seq_length, pred_length)
    val_dataset = TelemetryDataset(val_laps, seq_length, pred_length, mean=train_dataset.mean, std=train_dataset.std)

    train_loader = DataLoader(train_dataset, batch_size=64, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=64, shuffle=False)

    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model = TelemetryTCN(pred_length=pred_length).to(device)
    criterion = nn.MSELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=0.001)

    print(f"Training on {device}: {len(train_dataset)} train windows from {len(train_laps)} laps, "
          f"{len(val_dataset)} val windows from {len(val_laps)} laps.")

    # Track the best-val-loss checkpoint rather than just saving whatever the
    # final epoch happens to produce -- val loss on real telemetry is noisy
    # (observed directly: epoch 16's val loss was meaningfully better than
    # epoch 30's in the first real training run), so the last epoch is not
    # reliably the best one.
    best_val_loss = float('inf')
    best_state = None

    epochs = 30
    for epoch in range(epochs):
        model.train()
        train_loss = 0.0
        for batch_x, batch_y in train_loader:
            batch_x, batch_y = batch_x.to(device), batch_y.to(device)
            optimizer.zero_grad()
            outputs = model(batch_x)
            loss = criterion(outputs, batch_y)
            loss.backward()
            optimizer.step()
            train_loss += loss.item()
        train_loss /= len(train_loader)

        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for batch_x, batch_y in val_loader:
                batch_x, batch_y = batch_x.to(device), batch_y.to(device)
                outputs = model(batch_x)
                val_loss += criterion(outputs, batch_y).item()
        val_loss /= len(val_loader)

        is_best = val_loss < best_val_loss
        if is_best:
            best_val_loss = val_loss
            best_state = copy.deepcopy(model.state_dict())

        print(f"Epoch {epoch+1}/{epochs}, Train Loss: {train_loss:.4f}, Val Loss: {val_loss:.4f}"
              f"{' (best)' if is_best else ''}")

    os.makedirs(MODEL_DIR, exist_ok=True)
    torch.save({
        'model_state_dict': best_state,
        'mean': train_dataset.mean,
        'std': train_dataset.std,
        'seq_length': seq_length,
        'pred_length': pred_length,
    }, MODEL_PATH)
    print(f"Best val loss: {best_val_loss:.4f}")
    print(f"Model saved to {MODEL_PATH}")


class TelemetryPredictor:
    def __init__(self):
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.model = None

        if os.path.exists(MODEL_PATH):
            checkpoint = torch.load(MODEL_PATH, map_location=self.device)
            self.seq_length = checkpoint['seq_length']
            self.pred_length = checkpoint['pred_length']
            self.mean = checkpoint['mean'].to(self.device)
            self.std = checkpoint['std'].to(self.device)
            self.model = TelemetryTCN(pred_length=self.pred_length).to(self.device)
            self.model.load_state_dict(checkpoint['model_state_dict'])
            self.model.eval()
        else:
            print(f"WARNING: Model not found at {MODEL_PATH}. Run train_model() first.")
            self.seq_length = 20

    def predict(self, recent_data):
        # recent_data should be a list of dicts of length >= seq_length
        if not self.model or len(recent_data) < self.seq_length:
            return None

        x = [[d[f] for f in FEATURES] for d in recent_data[-self.seq_length:]]
        x_tensor = torch.tensor([x], dtype=torch.float32).to(self.device)
        x_tensor = (x_tensor - self.mean) / self.std

        with torch.no_grad():
            outputs = self.model(x_tensor)

        preds = outputs.squeeze(0).cpu().numpy()

        results = []
        for i in range(self.pred_length):
            results.append({f: float(preds[i, j]) for j, f in enumerate(FEATURES)})
        return results


if __name__ == "__main__":
    train_model()
