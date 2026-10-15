/**
 * Auf dem iPad (als App installiert) ist das Fenster der Seite kleiner als der Bildschirm: oben fehlt ein Streifen
 * (Statusleiste, Fensterrand). Beispiel iPad Pro 12,9" quer: Bildschirm 1366×1024, Fenster 1366×992, also 32 Punkte.
 * Das Startbild wird um diesen Streifen nach oben verlängert und deckt so den ganzen Bildschirm ab. Dann liegt seine Mitte
 * auf der Mitte des Bildschirms und passt zum iOS-Startbild (apple-touch-startup-image), das vorher kommt.
 */
export interface ViewportInfo {
  /** screen.width und screen.height (auf iOS immer Hoch-Maße) */
  screenW: number;
  screenH: number;
  innerW: number;
  innerH: number;
  standalone: boolean;
}

/** Höhe des fehlenden Streifens in Punkten. 0 außerhalb der installierten App, auf Handys und in kleinen Fenstern. */
export function splashBand(i: ViewportInfo): number {
  if (!i.standalone) return 0;
  const short = Math.min(i.screenW, i.screenH);
  if (short < 700) return 0; // nur Tablets
  const landscape = i.innerW > i.innerH;
  const physical = landscape ? short : Math.max(i.screenW, i.screenH);
  const band = physical - i.innerH;
  return band > 0 && band <= 60 ? Math.round(band) : 0;
}

export function currentBand(): number {
  if (typeof window === 'undefined') return 0;
  const nav = navigator as Navigator & { standalone?: boolean };
  return splashBand({
    screenW: window.screen.width,
    screenH: window.screen.height,
    innerW: window.innerWidth,
    innerH: window.innerHeight,
    standalone: window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true,
  });
}
