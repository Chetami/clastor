import React from "react";
import ReactDOM from "react-dom/client";
import { PostHogProvider } from "@posthog/react";
import { App } from "./app/App";
import { initShared } from "./lib/shared-bootstrap";
import "./index.css";

initShared();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PostHogProvider
      apiKey={import.meta.env.VITE_POSTHOG_PROJECT_TOKEN}
      options={{
        api_host: import.meta.env.VITE_POSTHOG_HOST,
        defaults: "2026-05-30",
      }}
    >
      <App />
    </PostHogProvider>
  </React.StrictMode>,
);
