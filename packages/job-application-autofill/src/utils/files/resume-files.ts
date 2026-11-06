export async function filePayload(
  file: File,
): Promise<{ fileName: string; base64: string }> {
  if (file.size > 10 * 1024 * 1024)
    throw new Error("Maximum resume size is 10 MB.");
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve({
        fileName: file.name,
        base64: result.slice(result.indexOf(",") + 1),
      });
    };
    reader.onerror = () => reject(new Error("Unable to read resume file"));
    reader.readAsDataURL(file);
  });
}

export function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2) + "\n"], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
