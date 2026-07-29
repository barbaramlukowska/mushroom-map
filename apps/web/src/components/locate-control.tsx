"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DomEvent, type LatLng } from "leaflet";
import { Circle, CircleMarker, useMapEvents } from "react-leaflet";
import { COLOR } from "@/lib/tokens";
import { locateErrorMessage } from "@/lib/locate-messages";
import { LocateIcon } from "./icons/locate-icon";

type LocateStatus = "idle" | "locating" | "found" | "error";

interface UserPosition {
  latlng: LatLng;
  accuracy: number;
}

// Locate button + "you are here" layer, for orientation only — the user's
// coordinates never leave the browser. Render inside a <MapContainer>.
export function LocateControl() {
  const [status, setStatus] = useState<LocateStatus>("idle");
  const [position, setPosition] = useState<UserPosition | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // The auto attempt on mount fails silently — the user did not ask for it.
  const silentAttempt = useRef(true);

  const map = useMapEvents({
    locationfound(e) {
      setPosition({ latlng: e.latlng, accuracy: e.accuracy });
      setStatus("found");
    },
    locationerror(e) {
      setStatus("error");
      if (silentAttempt.current) return;
      setErrorMessage(locateErrorMessage(e.code));
    },
  });

  useEffect(() => {
    if (errorMessage === null) return;
    const timer = setTimeout(() => setErrorMessage(null), 6000);
    return () => clearTimeout(timer);
  }, [errorMessage]);

  // Leaflet listens on the container, so React stopPropagation is not enough —
  // detach at the DOM level or the button click also opens the report form.
  const detachFromMap = useCallback((element: HTMLDivElement | null) => {
    if (element) DomEvent.disableClickPropagation(element);
  }, []);

  const startLocate = useCallback(() => {
    setStatus("locating");
    map.locate({ setView: true, maxZoom: 15, enableHighAccuracy: true, timeout: 10000 });
  }, [map]);

  // Locate on mount so the user lands on their own area without an extra tap.
  useEffect(() => {
    startLocate();
  }, [startLocate]);

  function handleLocateClick() {
    silentAttempt.current = false;
    startLocate();
  }

  return (
    <>
      {position && (
        <>
          <Circle
            center={position.latlng}
            radius={position.accuracy}
            pathOptions={{
              color: COLOR.forestMid,
              fillColor: COLOR.forestMid,
              fillOpacity: 0.15,
              weight: 1,
            }}
          />
          <CircleMarker
            center={position.latlng}
            radius={7}
            pathOptions={{
              color: COLOR.cream,
              fillColor: COLOR.forestMid,
              fillOpacity: 1,
              weight: 2,
            }}
          />
        </>
      )}
      <div ref={detachFromMap} className="absolute bottom-28 right-2.5 z-modal">
        <button
          type="button"
          onClick={handleLocateClick}
          disabled={status === "locating"}
          aria-label="Pokaż moją lokalizację"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line-strong bg-surface text-content shadow-md"
        >
          <LocateIcon
            className={
              status === "locating"
                ? "animate-pulse"
                : status === "found"
                  ? "text-fill"
                  : undefined
            }
          />
        </button>
      </div>
      {errorMessage && (
        <div className="fixed left-1/2 top-18 z-modal -translate-x-1/2 rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm">
          {errorMessage}
        </div>
      )}
    </>
  );
}
