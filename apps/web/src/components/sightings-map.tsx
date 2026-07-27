"use client";

import { useEffect, useMemo, useRef, type ReactElement } from "react";
import { divIcon, type DivIcon, type MarkerCluster } from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, ZoomControl, useMapEvents } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-markercluster";
import { SPECIES_LABELS, type Sighting } from "@runo-map/shared";
import { pinAgeCategory, type PinAge } from "@/lib/pin-age";
import { pinAppearance, type PinMode } from "@/lib/species-colors";
import { COLOR } from "@/lib/tokens";
import { buildTileUrl } from "@/lib/tile-url";
import "leaflet/dist/leaflet.css";
import "react-leaflet-markercluster/styles";

const POLAND_CENTER: [number, number] = [52.0, 19.5];

const MUSHROOM_PATH =
  "M12 3C7.5 3 4 6.5 4 10c0 2.5 1.5 4.5 3.5 5.5V19c0 .6.4 1 1 1h7c.6 0 1-.4 1-1v-3.5C18.5 14.5 20 12.5 20 10c0-3.5-3.5-7-8-7z";

function mushroomPin(age: PinAge, speciesColor: string | undefined, mode: PinMode): DivIcon {
  const { background, iconColor, size } = pinAppearance(age, speciesColor, mode);
  return divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;background:${background};border:2px solid rgba(255,255,255,0.7);border-radius:50%;box-shadow:0 3px 10px rgba(45,76,59,0.4);display:flex;align-items:center;justify-content:center;">
      <svg width="${size * 0.45}" height="${size * 0.45}" viewBox="0 0 24 24" fill="none"><path d="${MUSHROOM_PATH}" stroke="${iconColor}" stroke-width="1.6"/><line x1="12" y1="15.5" x2="12" y2="20" stroke="${iconColor}" stroke-width="1.6"/></svg>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// Icons are shared across markers with the same look; a new object per render
// would make react-leaflet re-apply setIcon and restart every cluster animation.
const iconCache = new Map<string, DivIcon>();

function pinIcon(age: PinAge, speciesColor: string | undefined, mode: PinMode): DivIcon {
  const key = `${mode}:${age}:${speciesColor ?? "none"}`;
  const cached = iconCache.get(key);
  if (cached) return cached;
  const icon = mushroomPin(age, speciesColor, mode);
  iconCache.set(key, icon);
  return icon;
}

// Cluster bubble grows with the number of pins inside; same forest palette as fresh pins.
function clusterIcon(cluster: MarkerCluster) {
  const count = cluster.getChildCount();
  const size = count < 10 ? 36 : count < 100 ? 44 : 52;
  return divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;background:${COLOR.forestMid};border:3px solid rgba(90,138,92,0.5);border-radius:50%;box-shadow:0 3px 10px rgba(45,76,59,0.4);display:flex;align-items:center;justify-content:center;color:${COLOR.cream};font:600 ${size * 0.38}px/1 system-ui,sans-serif;">${count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const AGE_LABELS: Record<PinAge, string> = {
  fresh: "Świeże",
  recent: "Ostatnie",
  older: "Starsze",
};

function formatFoundAgo(foundAt: string, now: Date): string {
  const days = Math.floor((now.getTime() - new Date(foundAt).getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "dzisiaj";
  if (days === 1) return "wczoraj";
  return `${days} dni temu`;
}

// Bridges Leaflet map clicks to React state in the parent.
function MapClickHandler({ onMapClick }: { onMapClick: (location: { lat: number; lng: number }) => void }) {
  useMapEvents({
    click(e) {
      onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

// Bridges Leaflet map movement to React state in the parent. Reports the visible
// area as a bbox string on every completed pan/zoom (moveend) and once on mount,
// so the initial fetch is keyed on the actual viewport.
function BboxHandler({ onBboxChange }: { onBboxChange: (bbox: string) => void }) {
  const map = useMapEvents({
    moveend() {
      onBboxChange(map.getBounds().toBBoxString());
    },
  });
  useEffect(() => {
    onBboxChange(map.getBounds().toBBoxString());
  }, [map, onBboxChange]);
  return null;
}

interface SightingsMapProps {
  sightings: Sighting[];
  speciesColors: Record<string, string>;
  mode: PinMode;
  onMapClick?: (location: { lat: number; lng: number }) => void;
  onBboxChange?: (bbox: string) => void;
}

function sightingMarker(
  sighting: Sighting,
  now: Date,
  speciesColors: Record<string, string>,
  mode: PinMode,
) {
  const age = pinAgeCategory(sighting.foundAt, now);
  const label = SPECIES_LABELS[sighting.species];
  return (
    <Marker
      key={sighting.id}
      position={[sighting.lat, sighting.lng]}
      icon={pinIcon(age, speciesColors[sighting.species], mode)}
    >
      <Popup>
        <strong>{label.pl}</strong>
        <br />
        <em>{label.latin}</em>
        <br />
        {AGE_LABELS[age]} — znalezione {formatFoundAgo(sighting.foundAt, now)}
        {sighting.comment && (
          <>
            <br />
            {sighting.comment}
          </>
        )}
      </Popup>
    </Marker>
  );
}

export function SightingsMap({
  sightings,
  speciesColors,
  mode,
  onMapClick,
  onBboxChange,
}: SightingsMapProps) {
  // Marker elements are cached per sighting id and reused across renders. React
  // then skips those subtrees, so react-leaflet never re-applies an unchanged
  // position — leaflet.markercluster reacts to a marker move by dropping and
  // re-adding it, which restarts every cluster animation (visible flicker).
  // A refetch therefore only touches the markers that actually appeared or left.
  // The cache is valid for one appearance only; a mode or color change resets it
  // inside the memo, because an effect would run too late for this render.
  const cache = useRef({ appearance: "", markers: new Map<string, ReactElement>() });
  const appearance = `${mode}:${Object.entries(speciesColors).sort().join()}`;

  const markers = useMemo(() => {
    const now = new Date();
    if (cache.current.appearance !== appearance) {
      cache.current = { appearance, markers: new Map() };
    }
    const next = new Map<string, ReactElement>();
    for (const sighting of sightings) {
      next.set(
        sighting.id,
        cache.current.markers.get(sighting.id) ??
          sightingMarker(sighting, now, speciesColors, mode),
      );
    }
    cache.current = { appearance, markers: next };
    return [...next.values()];
  }, [sightings, speciesColors, mode, appearance]);

  return (
    <MapContainer
      center={POLAND_CENTER}
      zoom={7}
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
      {onBboxChange && <BboxHandler onBboxChange={onBboxChange} />}
      <MarkerClusterGroup
        iconCreateFunction={clusterIcon}
        maxClusterRadius={60}
        showCoverageOnHover={false}
      >
        {markers}
      </MarkerClusterGroup>
    </MapContainer>
  );
}
