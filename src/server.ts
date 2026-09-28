import "dotenv/config";

import app from "./app.js";
import { connectDatabase } from "./config/database.js";
import { verifyMailer } from "./config/mailer.js";

const PORT = process.env.PORT || 5000;

const startServer = async (): Promise<void> => {
  await connectDatabase();
  await verifyMailer();

  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
};

startServer();