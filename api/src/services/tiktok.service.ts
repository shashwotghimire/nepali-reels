import { generateToken } from "../helpers/crypto.helper";

export const buildAuthUrl = () => {
  const state = generateToken();
  const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
  url.searchParams.set("client_key", process.env.TIKTOK_CLIENT_KEY!);
  url.searchParams.set("scope", "user.info.basic");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", process.env.TIKTOK_REDIRECT_URI!);
  url.searchParams.set("state", state);
  return { url: url.toString(), state };
};

export const exchangeCodeForToken = async (code: string) => {
  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cache-Control": "no-cache",
    },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: process.env.TIKTOK_REDIRECT_URI!,
    }),
  });
  const data = await res.json();
  return data;
};
