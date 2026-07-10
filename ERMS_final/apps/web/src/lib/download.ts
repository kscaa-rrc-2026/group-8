import { api } from "./api";

// A plain <a href>/window.open can't carry the Authorization header the
// API requires for any protected download - fetch as an authenticated
// blob instead and trigger the save from an in-memory object URL. Use
// this for every CSV/file export button in the app.
export async function downloadFile(path: string, filename: string, params?: Record<string, string>) {
  const res = await api.get(path, { params, responseType: "blob" });
  const url = URL.createObjectURL(res.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
