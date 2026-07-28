import { Suspense } from "react";
import { MapView } from "@/components/map-view";

// Data lives fully in the client now: the map never renders on the server, so a
// second (SSR) fetch path would add work with no visual benefit. MapView owns it,
// and it renders the filter panel too — below md that panel and the cell panel
// share one bottom sheet, so their open states have to meet somewhere.
// They read filters via useSearchParams(), which needs a Suspense boundary now
// that this page prerenders statically.
export default function HomePage() {
  return (
    <main>
      <Suspense>
        <MapView />
      </Suspense>
    </main>
  );
}
