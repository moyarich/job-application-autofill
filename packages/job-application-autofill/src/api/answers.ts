/** Mutate the current application's saved screening-answer records. */
export async function mutateApplicationAnswer(
  applicationId: string,
  profileId: string,
  method: "POST" | "PATCH" | "DELETE",
  payload: Record<string, string>,
): Promise<void> {
  const path =
    "/api/applications/" +
    encodeURIComponent(applicationId) +
    "/answers" +
    (method === "POST" ? "" : "/record");
  const response = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Moya-Client": "dashboard",
      "X-Profile-Id": profileId,
    },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Unable to update the library.");
}
