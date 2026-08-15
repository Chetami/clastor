// Student form schema + mappers live in @examify-tms/shared (shared with the
// mobile client). `rateTypeSchema` is re-exported from the payments module
// (identical definition) to preserve this module's public API.
export {
  studentStatusSchema,
  studentFormSchema,
  EMPTY_STUDENT_FORM,
  formToCreateRequest,
  formToUpdateRequest,
  type StudentFormData,
} from "@examify-tms/shared";
export { rateTypeSchema } from "@examify-tms/shared";
