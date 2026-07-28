"use client";

import { useEffect } from "react";
import { divIcon, type DivIcon } from "leaflet";
import { MapContainer, Marker, TileLayer, ZoomControl, useMapEvents } from "react-leaflet";
import type { OccurrenceCell } from "@runo-map/shared";
import { cellAppearance } from "@/lib/cell-appearance";
import { reportCountLabel } from "@/lib/report-count-label";
import { buildTileUrl } from "@/lib/tile-url";
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
  // role="img" + aria-label: the visible label can be blank at the low zooms, so
  // the count has to be spelled out for assistive technology either way.
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

// Bridges Leaflet map movement to React state in the parent. Reports the visible
// area and the zoom together on every completed pan/zoom (moveend covers both)
// and once on mount, so the initial fetch is keyed on the actual viewport.
// They travel as one object because the server needs both to answer at all —
// reporting them separately would fire a request with a stale zoom.
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
  // The zoom the cells were aggregated at — drives the circle labels. Undefined
  // until the parent has a view to report; no cells exist before that.
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
  // A cell has no stable id — it is derived from whatever matches the current
  // filter — so markers are rebuilt on every change. That is fine now: the old
  // per-sighting cache existed only to stop leaflet.markercluster from
  // restarting its animation, and clustering is gone.
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
