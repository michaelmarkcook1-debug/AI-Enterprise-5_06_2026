// This route previously auto-minted admin sessions with no token — REMOVED as a
// security regression. The admin gate is now at /api/admin/unlock (POST, token required).
export const dynamic = "force-dynamic";
export function GET() {
  return new Response("Gone — admin auto-unlock has been removed.", { status: 410 });
}
