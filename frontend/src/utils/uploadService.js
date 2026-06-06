import api from "../api/api";

export async function uploadFile(file) {
  const fd = new FormData();
  fd.append("image", file);

  const res = await api.post("/upload", fd, {
    headers: { "Content-Type": "multipart/form-data" }
  });

  return res.data.url;
}
