import axios from "axios";

export const api = axios.create({
  baseURL: `${process.env.REACT_APP_BACKEND_URL}/api`,
  withCredentials: true,
});
api.interceptors.request.use((config) => {
  const token = document.cookie
    .split("; ")
    .find((v) => v.startsWith("houston_csrf="))
    ?.split("=")[1];
  if (token) config.headers["X-CSRF-Token"] = decodeURIComponent(token);
  return config;
});
api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (
      error.response?.status === 401 &&
      !error.config.url.startsWith("/auth/")
    )
      window.dispatchEvent(new Event("session-expired"));
    return Promise.reject(error);
  },
);
export const errorKey = (error) => {
  if (!error.response) return "error.network";
  const code = error.response.data?.detail;
  return `error.${typeof code === "string" ? code : "validation"}`;
};
