"use client";

import { useEffect } from "react";
import { divIcon, type DivIcon } from "leaflet";
import { MapContainer, Marker, TileLayer, ZoomControl, useMapEvents } from "react-leaflet";
import type { OccurrenceCell } from "@runo-map/shared";
import { cellAppearance } from "@/lib/cell-appearance";
import { reportCountLabel } from "@/lib/report-count-label";
import { buildTileUrl } from "@/lib/tile-url";
import { LocateControl } from "./locate-control";
import "leaflet/dist/leaflet.css";

const POLAND_CENTER: [number, number] = [52.0, 19.5];
const INITIAL_ZOOM = 7;

function cellIcon(count: number, newestFoundAt: string, now: Date, zoom: number): DivIcon {
  const { diameter, fill, ink, outline, label, fontSize } = cellAppearance(
    count,
    newestFoundAt,
    now,
    zoom,
  );
  // aria-label: label can be blank at low zoom, so spell out the count for a11y.
  return divIcon({
    className: "",
    html: `<div role="img" aria-label="${reportCountLabel(count)}" style="width:${diameter}px;height:${diameter}px;background:${fill};border:2px solid ${outline};border-radius:50%;box-shadow:0 3px 10px rgba(45,76,59,0.35);display:flex;align-items:center;justify-content:center;color:${ink};font:600 ${fontSize}px/1 system-ui,sans-serif;">${label}</div>`,
    iconSize: [diameter, diameter],
    iconAnchor: [diameter / 2, diameter / 2],
  });
}

// Bridges Leaflet map clicks to React state in the parent.
function MapClickHandler({
  onMapClick,
}: {
  onMapClick: (location: { lat: number; lng: number }) => void;
}) {
  useMapEvents({
    click(e) {
      onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

// Bridges Leaflet map movement to React state; bbox+zoom travel together so
// the server never sees a stale zoom with a fresh bbox.
function ViewHandler({
  onViewChange,
}: {
  onViewChange: (view: { bbox: string; zoom: number }) => void;
}) {
  const map = useMapEvents({
    moveend() {
      onViewChange({ bbox: map.getBounds().toBBoxString(), zoom: map.getZoom() });
    },
  });
  useEffect(() => {
    onViewChange({ bbox: map.getBounds().toBBoxString(), zoom: map.getZoom() });
  }, [map, onViewChange]);
  return null;
}

interface SightingsMapProps {
  cells: OccurrenceCell[];
  // Zoom the cells were aggregated at — drives the circle labels.
  zoom?: number;
  onCellClick?: (cell: OccurrenceCell) => void;
  onMapClick?: (location: { lat: number; lng: number }) => void;
  onViewChange?: (view: { bbox: string; zoom: number }) => void;
}

export function SightingsMap({
  cells,
  zoom = INITIAL_ZOOM,
  onCellClick,
  onMapClick,
  onViewChange,
}: SightingsMapProps) {
  // Cells have no stable id, so markers rebuild on every change — fine now
  // that leaflet.markercluster (and its animation-restart concern) is gone.
  const now = new Date();

  return (
    <MapContainer
      center={POLAND_CENTER}
      zoom={INITIAL_ZOOM}
      zoomControl={false}
      style={{ width: "100%", height: "100dvh" }}
    >
      {/* Alidade Smooth: muted style + local (Polish) labels. Keyless on localhost; API key needed at deploy. */}
      <TileLayer
        url={buildTileUrl(process.env.NEXT_PUBLIC_STADIA_API_KEY)}
        attribution='&copy; <a href="https://www.stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <ZoomControl position="bottomright" />
      {onMapClick && <MapClickHandler onMapClick={onMapClick} />}
      {onViewChange && <ViewHandler onViewChange={onViewChange} />}
      <LocateControl />
      {cells.map((cell) => (
        <Marker
          key={`${cell.lat}:${cell.lng}`}
          position={[cell.lat, cell.lng]}
          icon={cellIcon(cell.count, cell.newestFoundAt, now, zoom)}
          eventHandlers={onCellClick ? { click: () => onCellClick(cell) } : undefined}
        />
      ))}
    </MapContainer>
  );
}
