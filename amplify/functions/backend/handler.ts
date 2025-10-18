export async function handler(event: any) {
  console.log("Received event:", event);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Hello from Amplify backend!",
      timestamp: new Date().toISOString(),
      input: event
    }),
  };
}
