export type Theme = "dark" | "light";
const KEY = "frigocold-theme";

/** Runs in <head> before the page paints, so a device set to the light look never flashes dark first. */
export const themeScript = `try{if(localStorage.getItem("${KEY}")==="light"){document.documentElement.classList.remove("dark");document.documentElement.classList.add("light")}}catch(e){}`;

export const currentTheme = (): Theme => (document.documentElement.classList.contains("light") ? "light" : "dark");

/** The look is chosen per device (kept in this browser), so the warehouse tablet can be light while a laptop stays dark. */
export function setTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("light", theme === "light");
  root.classList.toggle("dark", theme === "dark");
  try { localStorage.setItem(KEY, theme); } catch { /* Private mode: the choice lasts until the page is closed. */ }
}
