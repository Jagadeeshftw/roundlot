import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

const cfg = loadConfig();
const { app, facilitator } = await createApp(cfg);

app.listen(cfg.PORT, () => {
  console.log(
    `roundlot listening on :${cfg.PORT} payment=${cfg.payment.caip2} facilitator=${facilitator.kind} payTo=${cfg.PAY_TO}`,
  );
});
