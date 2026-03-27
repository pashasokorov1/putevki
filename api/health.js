export default async function handler(_request, response) {
  response.status(200).json({
    status: "ok",
    runtime: "vercel-functions",
    timestamp: new Date().toISOString()
  });
}
