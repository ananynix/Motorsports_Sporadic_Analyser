import os
import json
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
import numpy as np

class TelemetryDataset(Dataset):
    def __init__(self, data, seq_length=10, pred_length=5):
        self.seq_length = seq_length
        self.pred_length = pred_length
        self.features = []
        self.targets = []
        
        # We will use speed, rpm, throttle, brake_pressure, tire_temp_fl, tire_temp_fr
        # as features to predict future tire_temps (degradation) and rpm/brake (stress)
        for i in range(len(data) - seq_length - pred_length):
            seq = data[i : i + seq_length]
            pred = data[i + seq_length : i + seq_length + pred_length]
            
            x = [[d["speed"], d["rpm"], d["throttle"], d["brake_pressure"], d["tire_temp_fl"], d["tire_temp_fr"]] for d in seq]
            y = [[d["tire_temp_fl"], d["tire_temp_fr"], d["rpm"], d["brake_pressure"]] for d in pred]
            
            self.features.append(x)
            self.targets.append(y)
            
        self.features = torch.tensor(self.features, dtype=torch.float32)
        self.targets = torch.tensor(self.targets, dtype=torch.float32)
        
        # Normalize features
        self.mean = self.features.mean(dim=(0, 1), keepdim=True)
        self.std = self.features.std(dim=(0, 1), keepdim=True) + 1e-5
        self.features = (self.features - self.mean) / self.std

    def __len__(self):
        return len(self.features)

    def __getitem__(self, idx):
        return self.features[idx], self.targets[idx]

class TelemetryLSTM(nn.Module):
    def __init__(self, input_size=6, hidden_size=64, num_layers=2, output_size=4, pred_length=5):
        super(TelemetryLSTM, self).__init__()
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.pred_length = pred_length
        self.output_size = output_size
        
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True)
        self.fc = nn.Linear(hidden_size, pred_length * output_size)

    def forward(self, x):
        h0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size).to(x.device)
        c0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size).to(x.device)
        
        out, _ = self.lstm(x, (h0, c0))
        # Take the output from the last time step
        out = self.fc(out[:, -1, :])
        return out.view(x.size(0), self.pred_length, self.output_size)

def train_model():
    json_path = os.path.join(os.path.dirname(__file__), 'belgium_gp_telemetry.json')
    if not os.path.exists(json_path):
        print(f"Error: {json_path} not found.")
        return

    with open(json_path, 'r') as f:
        data = json.load(f)

    seq_length = 20
    pred_length = 10
    dataset = TelemetryDataset(data, seq_length=seq_length, pred_length=pred_length)
    dataloader = DataLoader(dataset, batch_size=32, shuffle=True)

    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model = TelemetryLSTM(pred_length=pred_length).to(device)
    criterion = nn.MSELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=0.001)

    print(f"Starting training on {device}...")
    model.train()
    epochs = 20
    for epoch in range(epochs):
        epoch_loss = 0
        for batch_x, batch_y in dataloader:
            batch_x, batch_y = batch_x.to(device), batch_y.to(device)
            optimizer.zero_grad()
            outputs = model(batch_x)
            loss = criterion(outputs, batch_y)
            loss.backward()
            optimizer.step()
            epoch_loss += loss.item()
        print(f"Epoch {epoch+1}/{epochs}, Loss: {epoch_loss/len(dataloader):.4f}")

    model_path = os.path.join(os.path.dirname(__file__), 'telemetry_lstm.pth')
    torch.save({
        'model_state_dict': model.state_dict(),
        'mean': dataset.mean,
        'std': dataset.std,
        'seq_length': seq_length,
        'pred_length': pred_length
    }, model_path)
    print(f"Model saved to {model_path}")

class TelemetryPredictor:
    def __init__(self):
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        model_path = os.path.join(os.path.dirname(__file__), 'telemetry_lstm.pth')
        self.model = None
        
        if os.path.exists(model_path):
            checkpoint = torch.load(model_path, map_location=self.device)
            self.seq_length = checkpoint['seq_length']
            self.pred_length = checkpoint['pred_length']
            self.mean = checkpoint['mean'].to(self.device)
            self.std = checkpoint['std'].to(self.device)
            self.model = TelemetryLSTM(pred_length=self.pred_length).to(self.device)
            self.model.load_state_dict(checkpoint['model_state_dict'])
            self.model.eval()
        else:
            print("WARNING: Model not found. Run train_model() first.")
            self.seq_length = 20

    def predict(self, recent_data):
        # recent_data should be a list of dicts of length seq_length
        if not self.model or len(recent_data) < self.seq_length:
            return None
            
        x = [[d["speed"], d["rpm"], d["throttle"], d["brake_pressure"], d["tire_temp_fl"], d["tire_temp_fr"]] for d in recent_data[-self.seq_length:]]
        x_tensor = torch.tensor([x], dtype=torch.float32).to(self.device)
        x_tensor = (x_tensor - self.mean) / self.std
        
        with torch.no_grad():
            outputs = self.model(x_tensor)
            
        # outputs shape: (1, pred_length, 4)
        preds = outputs.squeeze(0).cpu().numpy()
        
        results = []
        for i in range(self.pred_length):
            results.append({
                "tire_temp_fl": float(preds[i, 0]),
                "tire_temp_fr": float(preds[i, 1]),
                "rpm": float(preds[i, 2]),
                "brake_pressure": float(preds[i, 3]),
            })
        return results

if __name__ == "__main__":
    train_model()
