import { Almarai } from "next/font/google";

const almarai = Almarai({
  subsets: ["arabic"],
  weight: ["300", "400", "700", "800"],
  preload: false,
  display: 'swap',
  variable: '--font-almarai',
  adjustFontFallback: true,
});

export const almaraiClassName = almarai.variable;
export const almaraiStyle = almarai.style;
