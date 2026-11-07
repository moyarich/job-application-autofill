export function navigateTo(
  nextPerson: string,
  nextResume?: string,
  destination = "/workspace",
) {
  const url = new URL(window.location.href);
  url.searchParams.set("profile", nextPerson);
  if (nextResume) url.searchParams.set("resume", nextResume);
  else url.searchParams.delete("resume");
  url.pathname = destination;
  window.location.assign(url.href);
}\n