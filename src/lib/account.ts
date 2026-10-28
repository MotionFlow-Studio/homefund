/** The word the user types to confirm that everything should be deleted. */
export const DELETE_CONFIRMATION = "DELETE";

export type DeleteAccountError = "offline" | "unauthorized" | "unknown";

export const DELETE_ERROR_TEXT: Record<DeleteAccountError, string> = {
  offline: "You are offline. Connect to the internet to delete your data.",
  unauthorized: "Your session has ended. Sign in again, then try once more.",
  unknown: "Something went wrong and nothing was deleted. Please try again.",
};
