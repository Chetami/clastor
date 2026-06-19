import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import { readFileSync } from "fs";
import { resolve } from "path";
import YAML from "yaml";

const router = Router();

// Load the OpenAPI spec from the interfaces package
// npm workspaces run commands from the package directory, so we need to go up one level to reach root
const openApiPath = resolve(process.cwd(), "../interfaces/src/openapi.yaml");
const fileContents = readFileSync(openApiPath, "utf8");
const openApiSpec = YAML.parse(fileContents);

/**
 * GET /api/docs
 * Swagger UI for API documentation
 */
router.use(
  "/",
  swaggerUi.serve,
  swaggerUi.setup(openApiSpec, {
    customSiteTitle: "Examify TMS API Docs",
    customCss: ".swagger-ui .topbar { display: none }",
  })
);

/**
 * GET /api/docs.json
 * OpenAPI spec as JSON
 */
router.get("/json", (_req, res) => {
  res.json(openApiSpec);
});

export default router;
