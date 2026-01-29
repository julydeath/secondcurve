import "dotenv/config";
import { createApp } from "./app";
import { cancelOverdueUnpaidBookings, captureDuePayments } from "./services/payments";
import { resumeDueSubscriptions } from "./services/subscriptions";
import { ensureRollingSlots } from "./services/availability";

const port = Number.parseInt(process.env.PORT ?? "4000", 10);
const app = createApp();

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

const startSchedulers = () => {
  const run = async () => {
    await captureDuePayments();
    await cancelOverdueUnpaidBookings();
    await resumeDueSubscriptions();
    await ensureRollingSlots(8);
  };

  void run();
  setInterval(() => {
    void run();
  }, 5 * 60 * 1000);
};

startSchedulers();
