// JS mirror of the CSS primitives in globals.css :root.
// Single source of truth is that :root block — keep these hex values identical.
export const COLOR = {
  forestDeep: "#1a3c2a",
  forestMid: "#2d5a3d",
  forestMoss: "#4e7a50",
  forestSoft: "#5a8a5c",
  forestSage: "#8a9a88",
  forestPale: "#a0c49d",
  cream: "#fdfbf7",
  creamDim: "#f2efe7",
  stone: "#d8d4ce",
  amber: "#b45309",
  bark: "#5c4033",
  red: "#b3261e",
  cellFresh: "#3f2a1d",
  cellRecent: "#6b4a35",
  cellStale: "#c9b6a5",
  cellInkDark: "#3f2a1d",
} as const;

// Not part of COLOR because it is not an opaque hex — the contrast helpers in
// tokens.test.ts only handle 6-digit hex values.
export const CELL_OUTLINE = "rgba(48, 32, 22, 0.55)";
