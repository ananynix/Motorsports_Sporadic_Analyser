# Motorsports Sporadic Analyser

A high-performance, real-time telemetry and tactical comm-link analyzer built for motorsport environments. This application simulates an F1-style race engineer dashboard, fusing high-frequency mechanical telemetry (100Hz) with GPU-accelerated NLP transcription of driver radio communications to generate actionable tactical insights.

## Features

- **Real-Time Telemetry Dashboard**: Built with React and Recharts, featuring an aggressive, dark-mode F1 aesthetic using Tailwind CSS. Tracks live Speed, RPM, Throttle, Brake Pressure, and Tire Temperatures.
- **Audio NLP Processing Pipeline**: Utilizes a dedicated GPU-accelerated Docker container running PyTorch and HuggingFace's Whisper model to transcribe simulated sporadic driver radio communications.
- **Data Fusion Engine**: A FastAPI backend that contextually links transcribed radio audio with the exact mechanical state of the car at that specific timestamp to generate tactical insights (e.g., matching a driver saying "I'm losing grip" with tire temperature degradation).
- **Asynchronous Architecture**: Powered by Redis for high-speed pub/sub messaging and WebSockets for zero-latency UI updates.
- **Fully Containerized**: The entire microservice architecture (Frontend, API, GPU Worker, Redis) is orchestrated via Docker Compose.

## Architecture

1. **Frontend (React / Vite / Tailwind CSS)**
   - Connects to the backend via WebSockets.
   - Renders 100Hz telemetry streams using optimized `Recharts`.
   - Displays real-time tactical insights feed.

2. **Backend API (FastAPI / Python)**
   - `mock_generator.py`: Simulates live F1 telemetry at 100Hz.
   - `fusion_engine.py`: Fuses transcription text with localized telemetry windows.
   - Handles WebSocket connections and drops audio events into Redis.

3. **GPU Worker (PyTorch / Whisper)**
   - Dedicated Python container with NVIDIA CUDA passthrough.
   - Subscribes to Redis queues for new audio events.
   - Runs inference on radio communications and returns text transcripts.

4. **Redis Broker**
   - Manages state, telemetry caching, and asynchronous task queues between the API and the GPU Worker.

## Prerequisites

- **Docker** and **Docker Compose**
- **NVIDIA GPU** with CUDA support (for the NLP worker container)
- **NVIDIA Container Toolkit** (NVIDIA Docker) installed to allow GPU passthrough to the worker container.

## Getting Started

1. **Clone the repository:**
   ```bash
   git clone https://github.com/ananynix/Motorsports_Sporadic_Analyser.git
   cd Motorsports_Sporadic_Analyser
   ```

2. **Build and start the containers:**
   ```bash
   docker-compose up --build
   ```

3. **Access the Application:**
   - **Frontend UI**: `http://localhost:5173`
   - **Backend API**: `http://localhost:8000`

## Usage

1. Open the UI at `http://localhost:5173`. You will instantly see the live telemetry charts rendering the mock vehicle's data.
2. Click the aggressive red **SIMULATE RADIO TRANSMISSION** button in the top right.
3. This triggers a mock driver audio event. The GPU worker processes the simulated audio using Whisper, and the Fusion Engine combines the transcript with the active telemetry window.
4. The generated tactical insight will appear in the right-hand feed panel, color-coded by severity.

## Technologies Used

- **Frontend**: React, Vite, Tailwind CSS, Recharts, Zustand
- **Backend**: FastAPI, Uvicorn, WebSockets, Asyncio
- **AI / Machine Learning**: PyTorch, HuggingFace Transformers (Whisper)
- **Infrastructure**: Docker, Docker Compose, Redis
