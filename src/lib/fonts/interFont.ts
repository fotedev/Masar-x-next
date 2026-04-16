import { Inter } from "next/font/google";

const inter = Inter({ 
  subsets: ["latin"], 
  preload: false,
  display: 'swap',
  variable: '--font-inter',
  adjustFontFallback: true,
});

export const interClassName = inter.variable;
export const interStyle = inter.style;
