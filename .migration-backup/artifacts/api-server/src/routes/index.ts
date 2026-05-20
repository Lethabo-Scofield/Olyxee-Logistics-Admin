import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import businessRouter from "./business";
import dashboardRouter from "./dashboard";
import customersRouter from "./customers";
import ordersRouter from "./orders";
import auditRouter from "./audit";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(businessRouter);
router.use(dashboardRouter);
router.use(customersRouter);
router.use(ordersRouter);
router.use(auditRouter);

export default router;
