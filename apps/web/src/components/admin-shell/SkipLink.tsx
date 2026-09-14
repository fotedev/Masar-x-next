/**
 * SkipLink — the first focusable element in the admin shell.
 *
 * Visually hidden until focused, then a visible chip above everything.
 * Targets #ax-main-content, which AdminLayout renders with
 * tabIndex={-1}.
 */
export function SkipLink({ label }: { label: string }) {
  return (
    <a
      href="#ax-main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[90] focus:rounded-md focus:bg-ax-accent focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-ax-on-accent focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ax-accent focus:ring-offset-2 focus:ring-offset-ax-canvas"
    >
      {label}
    </a>
  );
}