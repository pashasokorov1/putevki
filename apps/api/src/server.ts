import { createApp } from "./app";

const port = Number(process.env.API_PORT ?? process.env.PORT ?? 3010);
const app = createApp();

app.listen(port, () => {
  console.log(`Fleet API listening on http://localhost:${port}`);
});
