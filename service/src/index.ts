import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

const cfg = loadConfig();
const { app, payments } = await createApp(cfg);

const server = app.listen(cfg.PORT, () => {
  console.log(
    `roundlot listening on :${cfg.PORT} payment=${cfg.payment.caip2} payments=${payments.status.state}/${payments.status.facilitator} payTo=${cfg.PAY_TO}`,
  );
});

// Railway sends SIGTERM on redeploy: stop taking requests, let in-flight
// payments finish settling, then exit.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    console.log(`${signal}: draining`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 10_000).unref();
  });
}
