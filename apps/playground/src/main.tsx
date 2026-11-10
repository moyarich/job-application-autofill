import React from "react";
import { createRoot } from "react-dom/client";
const root = document.getElementById("root");
if (!root) throw new Error("Missing documentation root");
createRoot(root).render(
  <React.StrictMode>
    <main
      style={{
        maxWidth: 800,
        margin: "60px auto",
        fontFamily: "system-ui",
        padding: 24,
      }}
    >
      <h1>Job application autofill documentation</h1>
      <p>
        The application lives in <code>packages/job-application-autofill</code>.
      </p>
      <p>
        <a href="http://localhost:5173">Open the application →</a>
      </p>
      <h2>Run the app</h2>
      <pre>npm run dev --workspace packages/job-application-autofill</pre>
      <p>
        Start the complete local stack with <code>npm run dev</code> from the
        repository root.
      </p>
    </main>
  </React.StrictMode>,
);
