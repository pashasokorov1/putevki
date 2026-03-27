import { loadState, saveState } from "./_lib/state.js";

export default async function handler(request, response) {
  try {
    if (request.method === "GET") {
      const result = await loadState();
      response.status(200).json(result);
      return;
    }

    if (request.method === "PUT") {
      const result = await saveState(request.body);
      response.status(200).json(result);
      return;
    }

    response.setHeader("Allow", "GET, PUT");
    response.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    response.status(500).json({
      error: "State API failed",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
