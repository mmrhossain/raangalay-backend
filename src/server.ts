import app from "./app.ts";
import { env } from "./config/env.ts";
import { startNotificationWorker } from "./modules/notification/worker/notification.worker.ts";

const server = app.listen(env.PORT, () => {
  console.log(
    `Server running on port ${env.PORT}`
  );
});

startNotificationWorker();

process.on("SIGTERM", () => {
  console.log("SIGTERM received");

  server.close(() => {
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received");

  server.close(() => {
    process.exit(0);
  });
});