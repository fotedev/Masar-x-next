import { readFileSync, writeFileSync, existsSync } from "node:fs";

const PATH = "node_modules/@lottiefiles/dotlottie-react/dist/index.js";

if (!existsSync(PATH)) {
  console.log(`[apply-lottie-patch] skip: ${PATH} not found`);
  process.exit(0);
}

let content = readFileSync(PATH, "utf8");

if (content.includes("let L=()=>{try{")) {
  console.log("[apply-lottie-patch] already patched, skipping");
  process.exit(0);
}

// Test the guard pattern (0.18.10)
const oldGuard = "D.current?.isLoaded&&D.current.activeAnimationId!==e&&D.current.loadAnimation(e??``)";
const newGuard = "D.current?.isLoaded&&D.current.activeAnimationId!==e&&(D.current.isLoaded&&(try{D.current.loadAnimation(e)}catch{},1))";

console.log("Has old guard:", content.includes(oldGuard));

if (content.includes(oldGuard)) {
  content = content.replace(oldGuard, newGuard, 1);
  console.log("Guard applied");
  writeFileSync(PATH, content, "utf8");
  console.log("File written");
}
