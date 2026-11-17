export type CameraFacing = "environment" | "user";
export type CameraResult = { stream: MediaStream } | { error: "denied" | "unavailable" };

/**
 * Opens the camera exactly once. The scanner library tries up to six times and swallows every error, which made
 * the permission prompt come back after each "Don't Allow" and quietly fell back to the front camera. Here a refusal
 * ends the attempt at once, and the rear camera is only left for another one when it really does not exist.
 */
export async function openCamera(facing: CameraFacing = "environment"): Promise<CameraResult> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return { error: "unavailable" };
  const denied = (error: unknown) => error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError");
  try {
    return { stream: await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing } }, audio: false }) };
  } catch (error) {
    if (denied(error)) return { error: "denied" };
  }
  try {
    // A device without the requested camera: take whichever one it has.
    return { stream: await navigator.mediaDevices.getUserMedia({ video: true, audio: false }) };
  } catch (error) {
    return { error: denied(error) ? "denied" : "unavailable" };
  }
}

export function stopStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((track) => track.stop());
}
