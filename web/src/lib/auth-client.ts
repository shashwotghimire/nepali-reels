import { createAuthClient } from "better-auth/react";
const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

export const { signIn, signOut, signUp, useSession } = authClient;
