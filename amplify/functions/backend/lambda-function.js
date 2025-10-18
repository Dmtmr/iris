import { processRequest } from "./backend-logic.js";

export async function handler(event) {
  console.log("Received event:", event);

  const result = await processRequest(event);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(result),
  };
}
