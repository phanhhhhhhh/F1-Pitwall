import { authFetch } from "./pitwall-auth";

export const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export { authFetch };
