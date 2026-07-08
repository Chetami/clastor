import { Router } from "express";
import { authenticateJWT } from "../middleware/auth";
import {
  createOrganisation,
  listMyOrganisations,
  getOrganisation,
  updateOrganisation,
  deleteOrganisation,
  regenerateJoinCode,
  listMembers,
  updateMemberRole,
  removeMember,
  joinOrganisation,
} from "../controllers/organisationController";

/**
 * Organisation routes — mounted at /api/organisations.
 *
 * Every route is authenticated. Org-admin authorisation (edit/delete, manage
 * members, regenerate code) is enforced inside the controllers via
 * orgMemberService.requireOrgAdmin, since it depends on per-org membership, not
 * a global role.
 *
 * Note: `/join` is declared before `/:orgId` so the literal path wins.
 */
const router = Router();

router.use(authenticateJWT);

// Join by code (literal path must precede the :orgId param routes).
router.post("/join", joinOrganisation);

// Create + list (switcher source).
router.post("/", createOrganisation);
router.get("/", listMyOrganisations);

// Single-org read/edit/delete.
router.get("/:orgId", getOrganisation);
router.patch("/:orgId", updateOrganisation);
router.delete("/:orgId", deleteOrganisation);

// Join-code management.
router.post("/:orgId/regenerate-code", regenerateJoinCode);

// Members.
router.get("/:orgId/members", listMembers);
router.patch("/:orgId/members/:userId", updateMemberRole);
router.delete("/:orgId/members/:userId", removeMember);

export default router;
