/**
 * FlashFender transactional email templates — re-exports.
 */

export { FF, FF_COPY, appBaseUrl, moneyCad, escHtml, fmtDateShort } from "./brands";
export {
  renderEmailLayout,
  buildPlainText,
  ctaButtonHtml,
  type EmailParts,
  type EmailCta,
  type RenderLayoutInput,
} from "./layout";
export { otpEmail, type OtpEmailInput } from "./otp";
export {
  forgotPasswordEmail,
  type ForgotPasswordEmailInput,
} from "./forgot-password";
export { inviteEmail, type InviteEmailInput } from "./invite";
export { invoiceEmail, type InvoiceEmailInput } from "./invoice";
export {
  quotationEmail,
  type QuotationEmailInput,
} from "./quotation";
export { crmEmail, type CrmEmailWrapInput } from "./crm";
