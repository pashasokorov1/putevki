import type { Driver, FuelSheetRecord, Vehicle } from "../../../packages/domain/src";

export type RemoteAppState = {
  vehicles: Vehicle[];
  drivers: Driver[];
  fuelSheets: FuelSheetRecord[];
};

function resolveApiRoot() {
  const configured = import.meta.env.VITE_API_URL?.trim();
  if (configured) {
    return configured.endsWith("/api") ? configured : `${configured.replace(/\/$/, "")}/api`;
  }

  if (typeof window === "undefined") {
    return "";
  }

  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    return "";
  }

  return "/api";
}

async function requestState(method: "GET" | "PUT", payload?: RemoteAppState) {
  const apiRoot = resolveApiRoot();
  if (!apiRoot) {
    return null;
  }

  const response = await fetch(`${apiRoot}/state`, {
    method,
    headers: {
      "Content-Type": "application/json"
    },
    body: payload ? JSON.stringify(payload) : undefined
  });

  if (!response.ok) {
    throw new Error(`State request failed with ${response.status}`);
  }

  const result = (await response.json()) as {
    payload: RemoteAppState;
    mode: "remote" | "fallback";
  };

  return result;
}

export async function loadRemoteAppState() {
  return requestState("GET");
}

export async function saveRemoteAppState(payload: RemoteAppState) {
  return requestState("PUT", payload);
}
