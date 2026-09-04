/**
 * App entry point ("main": "index.js" in package.json).
 *
 * React Navigation root lives in `app/App.tsx`; `registerRootComponent`
 * mounts it (and keeps Expo's error overlay / dev client behavior intact).
 */
import { registerRootComponent } from "expo";

import App from "./app/App";

registerRootComponent(App);