import numpy as np
from datetime import datetime, timedelta, UTC
from skyfield.api import load, wgs84, EarthSatellite, utc
from skyfield.toposlib import Topos

def get_satellite_object(tle_line1, tle_line2, name="Satellite", ts=None):
    """
    Creates a Skyfield EarthSatellite object from two TLE lines.
    """
    if ts is None:
        ts = load.timescale()
    return EarthSatellite(tle_line1, tle_line2, name, ts)

def get_current_position(satellite, timestamp, observer_lat=6.223301, observer_lon=-75.5959321, observer_elevation_m=1695):
    """
    Calculates the latitude, longitude, altitude, velocity of a satellite
    and its altitude and azimuth as seen from a specific ground observer.
    """
    ts = load.timescale()
    
    # Convert timestamp to Skyfield Time object
    if isinstance(timestamp, datetime):
        # Ensure the datetime is timezone-aware (UTC)
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=UTC)
        # Convert to Skyfield Time object
        timestamp = ts.from_datetime(timestamp)
    elif not isinstance(timestamp, ts.__class__):
        # Use current UTC time with timezone info
        current_time = datetime.now(UTC)
        timestamp = ts.from_datetime(current_time)
    
    try:
        # Get satellite position in geocentric coordinates
        geocentric = satellite.at(timestamp)
        
        # Convert to geographic coordinates (latitude, longitude, altitude)
        subpoint = wgs84.subpoint(geocentric)
        
        # Calculate velocity
        velocity = np.linalg.norm(geocentric.velocity.km_per_s)
        
        # Create observer position
        observer = wgs84.latlon(observer_lat, observer_lon, observer_elevation_m)
        
        # Calculate satellite position relative to observer
        difference = satellite - observer
        topocentric = difference.at(timestamp)
        alt, az, distance = topocentric.altaz()
        
        # Check if satellite is in sunlight
        is_visible = is_satellite_in_sunlight(satellite, timestamp)
        
        # Get the actual coordinates
        lat = subpoint.latitude.degrees
        lon = subpoint.longitude.degrees
        alt_km = subpoint.elevation.km
        
        # Print coordinates for debugging
        print(f"Satellite coordinates - Lat: {lat:.2f}°, Lon: {lon:.2f}°, Alt: {alt_km:.1f} km")
        
        return {
            "latitude": lat,
            "longitude": lon,
            "altitude": alt_km,
            "velocity": velocity * 1000,  # Convert to m/s
            "distance": distance.km,
            "alt": alt.degrees,
            "az": az.degrees,
            "visible": is_visible
        }
    except Exception as e:
        print(f"Error in get_current_position: {str(e)}")
        raise

def predict_satellite_positions(satellite, start_time, end_time, steps):
    """
    Predicts the positions of a satellite over a given time period.
    """
    ts = load.timescale()
    times = ts.linspace(start_time, end_time, steps)
    positions = []
    for t in times:
        geocentric = satellite.at(t)
        subpoint = wgs84.subpoint(geocentric)
        positions.append({
            "latitude": subpoint.latitude.degrees,
            "longitude": subpoint.longitude.degrees,
            "altitude": subpoint.elevation.km,
            "timestamp": t.utc_iso(),
        })
    return positions


def calculate_footprint_radius(altitude_km):
    """
    Approximates the Earth coverage radius of a satellite based on its altitude.
    Uses the formula: R_earth * arccos(R_earth / (R_earth + altitude))
    """
    R_earth = 6371  # Earth's radius in km
    angle = np.arccos(R_earth / (R_earth + altitude_km))
    footprint_radius = R_earth * angle
    return footprint_radius


def is_satellite_in_sunlight(satellite, timestamp):
    """
    Determines if a satellite is in sunlight at a given timestamp.
    """
    try:
        eph = load("de421.bsp")
        sun = eph["sun"]
        earth = eph["earth"]
        
        # Get the satellite's position at the given time
        satellite_pos = satellite.at(timestamp)
        
        # Get Earth's position at the given time
        earth_pos = earth.at(timestamp)
        
        # Get the Sun's position at the given time
        sun_pos = sun.at(timestamp)
        
        # Calculate the angle between the satellite-Earth vector and the Sun-Earth vector
        satellite_earth = satellite_pos - earth_pos
        sun_earth = sun_pos - earth_pos
        
        # Calculate the angle between the vectors
        angle = np.arccos(np.dot(satellite_earth.position.km, sun_earth.position.km) / 
                         (np.linalg.norm(satellite_earth.position.km) * 
                          np.linalg.norm(sun_earth.position.km)))
        
        # If the angle is less than 90 degrees, the satellite is in sunlight
        return angle < np.pi/2
    except Exception as e:
        print(f"Error in is_satellite_in_sunlight: {str(e)}")
        return True  # Default to visible if we can't determine
