import type { Metadata } from "next";
import Script from "next/script";

type PageProps = {
    searchParams: Promise<{
        token?: string;
        dealership_id?: string;
        limit?: string;
    }>;
};

export const metadata: Metadata = {
    title: "Inventory",
    robots: { index: false, follow: true },
};

export default async function EmbedInventoryIframePage({ searchParams }: PageProps) {
    const sp = await searchParams;
    const token = (sp.token || "").trim();
    const dealershipId = (sp.dealership_id || "").trim();
    const limitRaw = parseInt(sp.limit || "12", 10);
    const limit = Number.isFinite(limitRaw) ? String(Math.min(Math.max(limitRaw, 1), 100)) : "12";

    if (!token) {
        return (
            <main className="flex min-h-[40vh] items-center justify-center bg-white p-6 text-sm text-slate-500">
                Missing embed token. Copy the iframe snippet from Settings → Website embed.
            </main>
        );
    }

    return (
        <main className="min-h-full bg-transparent p-3 sm:p-4">
            <div
                data-adaptus-inventory
                data-token={token || undefined}
                data-dealership={dealershipId || undefined}
                data-limit={limit}
            />
            <Script src="/embed/inventory.js" strategy="afterInteractive" />
        </main>
    );
}
