export default function ThemeScript() {
  const code = `
    (() => {
      try {
        const LS_MODE = "theme.mode";
        const LS_CUSTOM = "theme.custom";
        const LIGHT = { primary:"#0f172a", primaryContrast:"#ffffff", bg:"#f8fafc", bg2:"#ffffff", text:"#0f172a", muted:"#475569", border:"#e5e7eb", ring:"#93c5fd" };
        const DARK  = { primary:"#60a5fa", primaryContrast:"#0b1220", bg:"#0b1220", bg2:"#0f1629", text:"#e5e7eb", muted:"#9aa4b2", border:"#1f2937", ring:"#2563eb" };

        const hexToRgb = (hex) => {
          const h = hex.replace("#", "");
          const normalized = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
          const n = parseInt(normalized, 16);
          return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
        };
        const isPerceivedDark = (palette) => {
          const [r, g, b] = hexToRgb(palette.bg || palette.bg2 || "#ffffff");
          const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          return lum < 140;
        };

        const apply = (palette, dt) => {
          const el = document.documentElement;
          el.setAttribute("data-theme", dt);
          el.style.setProperty("--primary", palette.primary);
          el.style.setProperty("--primary-contrast", palette.primaryContrast);
          el.style.setProperty("--bg", palette.bg);
          el.style.setProperty("--bg2", palette.bg2);
          el.style.setProperty("--bg-raised", palette.bg2);
          el.style.setProperty("--text", palette.text);
          el.style.setProperty("--muted", palette.muted);
          el.style.setProperty("--border", palette.border);
          el.style.setProperty("--ring", palette.ring);
          el.style.setProperty("--card-bg", palette.bg2);
          el.style.setProperty("--card-border", palette.border);
          el.style.setProperty("--btn-bg", palette.primary);
          el.style.setProperty("--btn-fg", palette.primaryContrast);
          el.style.setProperty("--btn-border", "transparent");
          const scheme = dt === "dark" || (dt === "custom" && isPerceivedDark(palette)) ? "dark" : "light";
          el.style.colorScheme = scheme;
        };

        const readCustom = () => {
          const raw = localStorage.getItem(LS_CUSTOM);
          if (!raw) return { ...LIGHT };
          try {
            const parsed = JSON.parse(raw);
            return { ...LIGHT, ...parsed };
          } catch {
            return { ...LIGHT };
          }
        };

        const mode = localStorage.getItem(LS_MODE) || "system";
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const systemPalette = prefersDark ? DARK : LIGHT;

        let palette = LIGHT;
        let dt = "light";
        if (mode === "light") {
          palette = LIGHT;
          dt = "light";
        } else if (mode === "dark") {
          palette = DARK;
          dt = "dark";
        } else if (mode === "custom") {
          palette = readCustom();
          dt = "custom";
        } else {
          palette = systemPalette;
          dt = prefersDark ? "dark" : "light";
        }

        apply(palette, dt);
      } catch (e) {
        // ignore
      }
    })();
  `;

  return <script dangerouslySetInnerHTML={{ __html: code }} suppressHydrationWarning />;
}
