export default function ThemeScript() {
  const code = `
    (() => {
      try {
        const LS_MODE = "theme.mode";
        const LS_CUSTOM = "theme.custom";
        const LIGHT = { primary:"#9fc31b", primaryContrast:"#061006", bg:"#f6f1e8", bg2:"#fffdf8", text:"#171915", muted:"#696a61", border:"#e5dccd", ring:"#d8ff3d" };
        const DARK  = { primary:"#d8ff3d", primaryContrast:"#061006", bg:"#080d0b", bg2:"#101812", text:"#fffdf2", muted:"#aeb7a7", border:"#263327", ring:"#9fc31b" };
        const RANDOM = [
          { primary:"#14b8a6", primaryContrast:"#042f2e", bg:"#08111f", bg2:"#111c2f", text:"#edfdfb", muted:"#9fc7c1", border:"#1f3b45", ring:"#5eead4" },
          { primary:"#f97316", primaryContrast:"#fff7ed", bg:"#130f1d", bg2:"#201a2f", text:"#fff7ed", muted:"#c9b9a9", border:"#3a2c35", ring:"#fed7aa" },
          { primary:"#a3e635", primaryContrast:"#17230b", bg:"#0b1510", bg2:"#142319", text:"#f5ffe8", muted:"#b7c9ab", border:"#2b3e2d", ring:"#bef264" },
          { primary:"#38bdf8", primaryContrast:"#082f49", bg:"#081526", bg2:"#10233a", text:"#eff8ff", muted:"#a9bfd0", border:"#223c55", ring:"#7dd3fc" },
          { primary:"#fb7185", primaryContrast:"#fff1f2", bg:"#180f19", bg2:"#281728", text:"#fff5f7", muted:"#d0b5bf", border:"#432537", ring:"#fda4af" }
        ];

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
          el.style.setProperty("--bg-accent", palette.primary);
          el.style.setProperty("--bg-accent-2", palette.ring);
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

        const mode = localStorage.getItem(LS_MODE);
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const systemPalette = prefersDark ? DARK : LIGHT;

        let palette = LIGHT;
        let dt = "light";
        if (!mode) {
          palette = RANDOM[Math.floor(Math.random() * RANDOM.length)] || DARK;
          dt = "custom";
        } else if (mode === "light") {
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
