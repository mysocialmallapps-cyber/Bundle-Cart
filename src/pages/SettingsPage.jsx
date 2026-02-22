import { useEffect, useMemo, useState } from "react";
import { API_BASE_URL, api, getIntegrationConfig } from "../api";

export default function SettingsPage() {
  const [healthStatus, setHealthStatus] = useState("Checking...");

  useEffect(() => {
    const controller = new AbortController();
    api
      .getHealth(controller.signal)
      .then(() => setHealthStatus("Connected"))
      .catch(() => setHealthStatus("Unavailable"));
    return () => controller.abort();
  }, []);

  const config = getIntegrationConfig();
  const runtimeConfig =
    typeof window !== "undefined" ? window.__BUNDLECART_CONFIG__ || {} : {};

  const envRows = useMemo(
    () => [
      { name: "APP_URL", value: runtimeConfig.APP_URL || import.meta.env.APP_URL || "Not set" },
      {
        name: "REDIRECT_URL",
        value:
          runtimeConfig.REDIRECT_URL ||
          import.meta.env.REDIRECT_URL ||
          `${runtimeConfig.APP_URL || import.meta.env.APP_URL || window.location.origin}/auth/callback`
      },
      { name: "API_BASE_URL", value: API_BASE_URL },
      { name: "MODE", value: import.meta.env.MODE }
    ],
    [runtimeConfig.APP_URL, runtimeConfig.REDIRECT_URL]
  );

  return (
    <div className="page">
      <div className="page-header">
        <h3>Settings / Integration</h3>
      </div>

      <div className="card">
        <h4>Shopify Integration</h4>
        <p>
          API status:{" "}
          <span className={`status-pill ${healthStatus === "Connected" ? "status-ok" : "status-warning"}`}>
            {healthStatus}
          </span>
        </p>
        <ul className="integration-list">
          <li>
            <strong>App URL:</strong> {config.appUrl}
          </li>
          <li>
            <strong>OAuth Start:</strong> {config.oauthStart}
          </li>
          <li>
            <strong>OAuth Callback:</strong> {config.oauthCallback}
          </li>
          <li>
            <strong>Redirect URL:</strong> {config.redirectUrl}
          </li>
        </ul>
      </div>

      <div className="card">
        <h4>Environment Variables</h4>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Variable</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {envRows.map((row) => (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  <td>{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h4>Express Hosting Notes</h4>
        <p className="subtle">
          Build the frontend with <code>npm run build</code> and serve the generated dist folder from your
          Express backend.
        </p>
        <pre className="code-block">{`import path from "node:path";
import express from "express";

const app = express();
const distPath = path.resolve("dist");

app.get("/app-config.js", (_req, res) => {
  const appUrl = process.env.APP_URL || "";
  const redirectUrl = process.env.REDIRECT_URL || appUrl + "/auth/callback";
  res.type("application/javascript").send(
    \`window.__BUNDLECART_CONFIG__ = { APP_URL: "\${appUrl}", REDIRECT_URL: "\${redirectUrl}" };\`
  );
});

app.use(express.static(distPath));
app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});`}</pre>
      </div>
    </div>
  );
}
