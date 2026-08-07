/**
 * Barrel for backend request-validation Zod schemas.
 *
 * Schemas mirror the OpenAPI request types defined under
 * interfaces/src/schemas. Apply them on routes via the
 * validateRequest({ body, query, params }) middleware.
 */
export * from "./common";
export * from "./students";
export * from "./lessons";
export * from "./payments";
export * from "./users";
export * from "./misc";
export * from "./queries";
