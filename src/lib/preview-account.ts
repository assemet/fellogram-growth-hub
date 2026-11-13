/**
 * The shared preview account is for development only: allowed while no bot token is configured, or when
 * ALLOW_PREVIEW_ACCOUNT=true is set on purpose (for example a staging copy). Never in a normal production setup.
 */
export function previewAccountAllowed(botToken: string | undefined, allowFlag: string | undefined = process.env["ALLOW_PREVIEW_ACCOUNT"]): boolean {
  return !botToken || allowFlag === "true";
}
