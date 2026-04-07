import { Almarai } from "next/font/google";

const almarai = Almarai({
  subsets: ["arabic"],
  weight: ["300", "400", "700", "800"],
  preload: false,
});

export const almaraiClassName = almarai.className;
