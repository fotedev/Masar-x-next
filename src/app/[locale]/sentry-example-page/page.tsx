"use client";

import * as Sentry from "@sentry/nextjs";

export default function SentryExamplePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 space-y-8 bg-gray-50 text-gray-900">
      <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg space-y-6">
        <h1 className="text-2xl font-bold text-center">Sentry Verification</h1>
        <p className="text-gray-600 text-center">
          Use the buttons below to trigger different types of errors and verify your Sentry integration.
        </p>
        
        <div className="space-y-4">
          <button
            type="button"
            className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors shadow-sm"
            onClick={() => {
              throw new Error("Sentry Client-Side Test Error");
            }}
          >
            Throw Client-Side Error
          </button>

          <button
            type="button"
            className="w-full py-3 px-4 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg transition-colors shadow-sm"
            onClick={async () => {
              try {
                const response = await fetch("/api/sentry-example-api");
                if (!response.ok) {
                  throw new Error("API call failed");
                }
              } catch (err) {
                console.error("Caught error:", err);
              }
            }}
          >
            Trigger Server-Side API Error
          </button>
          
          <button
            type="button"
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors shadow-sm"
            onClick={() => {
              Sentry.captureMessage("Test Sentry Message");
              alert("Message sent to Sentry!");
            }}
          >
            Send Sentry Message
          </button>
        </div>
      </div>
      
      <p className="text-sm text-gray-500">
        Check your Sentry dashboard after clicking these buttons.
      </p>
    </div>
  );
}
