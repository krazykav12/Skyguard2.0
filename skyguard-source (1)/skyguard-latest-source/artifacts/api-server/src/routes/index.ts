import { Router, type IRouter } from "express";
import healthRouter from "./health";
import environmentRouter from "./environment";

const router: IRouter = Router();

router.use(healthRouter);
router.use(environmentRouter);

export default router;
