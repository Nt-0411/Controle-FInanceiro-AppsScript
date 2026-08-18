// Paleta categórica validada (ordem fixa — ver skill de dataviz).
export const CATEGORICAL = [
  { light: "#2a78d6", dark: "#3987e5" }, // blue
  { light: "#eb6834", dark: "#d95926" }, // orange
  { light: "#1baf7a", dark: "#199e70" }, // aqua
  { light: "#eda100", dark: "#c98500" }, // yellow
  { light: "#e87ba4", dark: "#d55181" }, // magenta
  { light: "#008300", dark: "#008300" }, // green
  { light: "#4a3aa7", dark: "#9085e9" }, // violet
  { light: "#e34948", dark: "#e66767" }, // red
];

export const MUTED = { light: "#898781", dark: "#898781" };

export function categoricalColor(index, isDark = false) {
  if (index >= CATEGORICAL.length) return isDark ? MUTED.dark : MUTED.light;
  return isDark ? CATEGORICAL[index].dark : CATEGORICAL[index].light;
}

export function useIsDark() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
}

export const CHROME = {
  gridline: { light: "#e1e0d9", dark: "#2c2c2a" },
  baseline: { light: "#c3c2b7", dark: "#383835" },
  muted: { light: "#898781", dark: "#898781" },
  secondary: { light: "#52514e", dark: "#c3c2b7" },
};
