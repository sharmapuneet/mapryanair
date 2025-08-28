import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  useMap
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import airlineLogo from './assets/airplane1.png';
import pin from './assets/logo.png';

// Jetstar destinations from Melbourne
const destinations = {
  MEL: { name: "Melbourne", coordinates: [-37.8136, 144.9631], price: 0 },
  ADL: { name: "Adelaide", coordinates: [-34.9285, 138.6007], price: 100 },
  BNE: { name: "Brisbane", coordinates: [-27.4698, 153.0251], price: 120 },
  CNS: { name: "Cairns", coordinates: [-16.9203, 145.7710], price: 150 },
  CBR: { name: "Canberra", coordinates: [-35.2809, 149.1300], price: 130 },
  DRW: { name: "Darwin", coordinates: [-12.4634, 130.8456], price: 180 },
  OOL: { name: "Gold Coast", coordinates: [-28.0167, 153.4000], price: 110 },
  HBA: { name: "Hobart", coordinates: [-42.8821, 147.3272], price: 140 },
  PER: { name: "Perth", coordinates: [-31.9505, 115.8605], price: 200 },
  SYD: { name: "Sydney", coordinates: [-33.8688, 151.2093], price: 100 },
  SIN: { name: "Singapore", coordinates: [1.3521, 103.8198], price: 300 },
  BKK: { name: "Bangkok", coordinates: [13.7563, 100.5018], price: 350 },
  DPS: { name: "Bali", coordinates: [-8.3405, 115.0920], price: 320 },
  AKL: { name: "Auckland", coordinates: [-36.8485, 174.7633], price: 400 },
  ZQN: { name: "Queenstown", coordinates: [-45.0312, 168.6626], price: 450 },
};

// Calculate bearing for airplane rotation
function getBearing(start: number[], end: number[]) {
  const [lat1, lon1] = start.map(x => (x * Math.PI) / 180);
  const [lat2, lon2] = end.map(x => (x * Math.PI) / 180);
  const dLon = lon2 - lon1;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

// Generate curved arc between two points
function generateArc(from: number[], to: number[], segments = 100) {
  const lat1 = from[0], lng1 = from[1];
  const lat2 = to[0], lng2 = to[1];
  const curve: number[][] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const lat = lat1 + (lat2 - lat1) * t;
    const lng = lng1 + (lng2 - lng1) * t;
    const offset = Math.sin(Math.PI * t) * 10;
    curve.push([lat + offset * 0.1, lng]);
  }
  return curve;
}

// Animated airplane along route
function AirplaneAnimation({ path }: { path: number[][] }) {
  const [position, setPosition] = useState(path[0]);
  const [rotation, setRotation] = useState(0);
  const indexRef = useRef(0);

  // Compute bearing in degrees for Leaflet
  const computeBearing = (start: number[], end: number[]) => {
    const lat1 = (start[0] * Math.PI) / 180;
    const lon1 = (start[1] * Math.PI) / 180;
    const lat2 = (end[0] * Math.PI) / 180;
    const lon2 = (end[1] * Math.PI) / 180;

    const dLon = lon2 - lon1;
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x =
      Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    return (Math.atan2(y, x) * 180) / Math.PI;
  };

  useEffect(() => {
    indexRef.current = 0;
    setPosition(path[0]);
    setRotation(computeBearing(path[0], path[1]));

    const interval = setInterval(() => {
      if (indexRef.current < path.length - 1) {
        const nextIndex = indexRef.current + 1;
        const newPos = path[nextIndex];

        const brng = computeBearing(path[indexRef.current], newPos);

        // If airplane image points to right, add 90 degrees
        const adjustedRotation = brng; // or brng + 90 if needed
        setRotation(adjustedRotation);
        setPosition(newPos);

        indexRef.current = nextIndex;
      } else clearInterval(interval);
    }, 100);

    return () => clearInterval(interval);
  }, [path]);

  const airplaneIcon = new L.DivIcon({
    html: `
      <div style="
        transform: rotate(${rotation}deg);
        transform-origin: center center;
        width: 32px;
        height: 32px;
      ">
        <img src="${airlineLogo}" style="width:32px;height:32px;" />
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    className: "",
  });

  return <Marker position={position} icon={airplaneIcon} />;
}

// Fit map bounds with dynamic zoom
function FitBounds({ path }: { path: number[][] }) {
  const map = useMap();

  const getDistance = (a: number[], b: number[]) => {
    const latDiff = a[0] - b[0];
    const lngDiff = a[1] - b[1];
    return Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
  };

  useEffect(() => {
    if (path && path.length > 0) {
      const start = path[0];
      const end = path[path.length - 1];
      const distance = getDistance(start, end);

      // Dynamic max zoom based on distance
      let maxZoom = 5;
      if (distance < 10) maxZoom = 4;
      else if (distance < 20) maxZoom = 5;
      else if (distance < 50) maxZoom = 6;
      else maxZoom = 7;

      map.fitBounds(path, { padding: [50, 50], maxZoom });
    }
  }, [path, map]);

  return null;
}

export default function FlightSearchMap() {
  const [origin] = useState("MEL");
  const [destination, setDestination] = useState("SYD");

  const route = useMemo(() => {
    if (destinations[origin] && destinations[destination]) {
      return {
        from: destinations[origin],
        to: destinations[destination],
        curve: generateArc(destinations[origin].coordinates, destinations[destination].coordinates, 200)
      };
    }
    return null;
  }, [origin, destination]);

  const cardRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

useEffect(() => {
  const card = cardRefs.current[destination];
  if (card) {
    card.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}, [destination]);

  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw" }}>
      {/* Sidebar */}
      <div style={{ width: 300, height: "100vh", display: "flex", flexDirection: "column", background: "#f8f8f8" }}>
        {/* Fixed search bar */}
        <div style={{ padding: 10, background: "#fff", color: "white", position: "sticky", top: 0, zIndex: 10 }}>
          <input
            type="text"
            placeholder="Origin (e.g. MEL)"
            value={origin}
            disabled
            style={{ padding: 5, width: "100%", marginBottom: 5 }}
          />
          <select
            value={destination}
            onChange={e => setDestination(e.target.value)}
            style={{ padding: 5, width: "100%" }}
          >
            {Object.entries(destinations)
              .filter(([code]) => code !== origin)
              .map(([code, airport]) => (
                <option key={code} value={code}>
                  {airport.name} ({airport.price > 0 ? `From $${airport.price}` : "Free"})
                </option>
              ))}
          </select>
        </div>

        {/* Scrollable flight cards */}
        <div style={{ overflowY: "auto", flex: 1, padding: 10 }}>
  {Object.entries(destinations)
    .filter(([code]) => code !== origin)
    .map(([code, airport]) => (
      <div
        key={code}
        ref={el => (cardRefs.current[code] = el)}
        style={{
          border: code === destination ? "2px solid #0078d7" : "1px solid #ccc",
          background: code === destination ? "#e13a00" : "#ff5115", // highlight selected
          padding: 10,
          marginBottom: 10,
          borderRadius: 5,
          cursor: "pointer",
        }}
        onClick={() => setDestination(code)}
      >
        <strong>{airport.name}</strong>
        <p>{airport.price > 0 ? `From $${airport.price}` : "Origin"}</p>
      </div>
    ))}
</div>
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: "relative" }}>
        <MapContainer center={destinations[origin].coordinates} zoom={4} style={{ height: "100%", width: "100%" }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {/* All airport markers with price tooltip */}
          {Object.entries(destinations).map(([code, airport]) => {
            const iconHtml = `
              <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
                <img src="${pin}" style="width:32px;height:32px;" />
                ${airport.price > 0 ? `<span style="
                  position: absolute;
                  top: -20px;
                  background: #0078d7;
                  color: white;
                  padding: 2px 5px;
                  border-radius: 4px;
                  font-size: 10px;
                  white-space: nowrap;
                ">From $${airport.price}</span>` : ''}
              </div>
            `;
            const airportIcon = new L.DivIcon({
              html: iconHtml,
              className: "",
              iconSize: [32, 32],
              iconAnchor: [16, 16],
            });
            return (
              <Marker
                key={code}
                position={airport.coordinates}
                icon={airportIcon}
                eventHandlers={{ click: () => setDestination(code) }}
              >
                <Popup>
                  <strong>{airport.name}</strong> ({code}) <br />
                  {airport.price > 0 ? `From $${airport.price}` : "Origin"}
                  {origin === code && " 🛫"}
                  {destination === code && " 🛬"}
                </Popup>
              </Marker>
            );
          })}

          {/* Route and airplane */}
          {route && (
            <>
              <FitBounds path={route.curve} />
              <Polyline positions={route.curve} color="blue" weight={3} />
              <AirplaneAnimation path={route.curve} />
            </>
          )}
        </MapContainer>
      </div>
    </div>
  );
}
