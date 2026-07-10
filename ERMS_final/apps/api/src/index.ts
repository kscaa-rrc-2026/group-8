import "dotenv/config";
import cors from "cors";
import express from "express";
import { authRouter } from "./auth/routes";
import { attachmentsRouter } from "./attachments/routes";
import { errorHandler } from "./middleware/errorHandler";
import { employeeRouter } from "./modules/employee/routes";
import { managerRouter } from "./modules/manager/routes";
import { accountsRouter } from "./modules/accounts/routes";
import { adminRouter } from "./modules/admin/routes";
import { reportsRouter } from "./modules/reports/routes";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ data: { status: "ok" } }));

app.use("/api/auth", authRouter);
app.use("/api/attachments", attachmentsRouter);
app.use("/api/employee", employeeRouter);
app.use("/api/manager", managerRouter);
app.use("/api/accounts", accountsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/reports", reportsRouter);

// Must be mounted last.
app.use(errorHandler);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
