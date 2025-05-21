# NOAA Satellite Tracker

A real-time satellite tracking application that monitors NOAA weather satellites, displaying their current positions and trajectories on an interactive map.

## Features

- Real-time tracking of NOAA 15, 18, and 19 satellites
- Interactive map display using MapLibre GL
- Current satellite positions with coordinates
- Satellite visibility status (sunlight/shadow)
- Satellite footprint radius calculation
- Position prediction for future orbits

## Screenshots

![](https://raw.githubusercontent.com/jero98772/Noaa_sat_tracker/refs/heads/main/docs/1.png)

## Prerequisites

- Python 3.8 or higher
- pip (Python package installer)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/jero98772/Noaa_sat_tracker
cd Noaa_sat_tracker
```

2. Create a virtual environment (recommended):
```bash
python -m venv venv
source venv/bin/activate  # On Windows, use: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

## Usage

1. Start the Flask server:
```bash
python main.py
```

2. Open your web browser and navigate to:
```
http://localhost:8000
```

The application will display an interactive map with the current positions of NOAA satellites. The control panel on the right shows detailed information about each satellite.

## API Endpoints

- `/` - Main application interface
- `/satellites` - List of available satellites with TLE data
- `/positions` - Current positions of all tracked satellites
- `/predict/<norad_id>` - Predict future positions for a specific satellite
  - Parameters:
    - `hours`: Prediction time span (default: 24)
    - `points`: Number of prediction points (default: 100)

## Technical Details

The application uses:
- Flask for the backend server
- MapLibre GL for map visualization
- Skyfield for satellite position calculations
- TLE (Two-Line Element) data for satellite tracking

## License

This project is licensed under the MIT License.licensed under the GNU General Public License v3.0 (GPL-3.0)
