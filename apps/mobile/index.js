/**
 * App entry point ("main": "index.js" in package.json).
 *
 * Sentry init (spec 023) runs first so errors thrown during the module
 * graph evaluation of the app itself are still captured; it is a no-op
 * when EXPO_PUBLIC_SENTRY_DSN was absent at build time.
 *
 * React Navigation root lives in `app/App.tsx`; `registerRootComponent`
 * mounts it (and keeps Expo's error overlay / dev client behavior intact).
 */
import { registerRootComponent } from "expo";

import App from "./app/App";
import { initSentry } from "./src/lib/sentry";

initSentry();

registerRootComponent(App);
