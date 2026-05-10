import { listNewsItems } from "@/lib/intelligence/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const vendor = url.searchParams.get("vendor");
  const category = url.searchParams.get("category");
  const news = await listNewsItems();

  return Response.json({
    news: news.filter((item) => {
      if (vendor && !item.vendors.includes(vendor)) return false;
      if (category && !item.categories.some((itemCategory) => itemCategory === category)) return false;
      return true;
    }),
  });
}
