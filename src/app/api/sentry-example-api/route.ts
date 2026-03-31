export const dynamic = "force-dynamic";

export async function GET() {
  // Simulate a server-side error
  throw new Error("Sentry Server-Side API Test Error");
}
