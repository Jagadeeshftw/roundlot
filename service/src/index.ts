import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

const cfg = loadConfig();
const { app, payments } = await createApp(cfg);

app.listen(cfg.PORT, () => {
  console.log(
    `roundlot listening on :${cfg.PORT} payment=${cfg.payment.caip2} payments=${payments.status.state}/${payments.status.facilitator} payTo=${cfg.PAY_TO}`,
  );
});
