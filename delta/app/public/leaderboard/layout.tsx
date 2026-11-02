import Script from "next/script";

/*
 * The office TVs' photos and videos (2026-11-02): Root's overlay plays the ones a root admin chose for this TV, then
 * the leaderboard for its minute, and again. Nothing chosen, or Root unreachable: the leaderboard as before.
 */
const ROOT_API = (process.env.NEXT_PUBLIC_ROOT_API_URL ?? "https://root-api-sales-crm.deltainstitutions.com").replace(/\/+$/, "");

export default function PublicLeaderboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Script src={`${ROOT_API}/api/v1/public/tv/overlay.js?screen=banglore`} strategy="afterInteractive" />
    </>
  );
}
