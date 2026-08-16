"use client";

import { useCallback, useEffect, useState } from "react";
import { GitMerge, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { apiFetch } from "@/src/lib/fetch";
import { toast } from "@/src/lib/toast";
import { ModalShell } from "@/src/components/ui/ModalShell";
import { Button } from "@/src/components/ui/Button";

export interface MergeCustomer {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    province: string | null;
    postal_code: string | null;
    status: string;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

interface DupGroup {
    reason: string;
    members: MergeCustomer[];
}

interface CustomerMergeModalProps {
    open: boolean;
    onClose: () => void;
    onMerged: () => void;
    /** Optional pre-selected pair from the directory */
    seedKeepId?: string | null;
    seedMergeId?: string | null;
}

function Field({ label, a, b }: { label: string; a: string | null | undefined; b: string | null | undefined }) {
    const left = a || "—";
    const right = b || "—";
    const mismatch = (a || "") !== (b || "") && Boolean(a || b);
    return (
        <div className="grid grid-cols-[7rem_1fr_1fr] gap-2 border-b border-gray-100 py-2 text-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
            <div className={mismatch ? "text-gray-900" : "text-gray-700"}>{left}</div>
            <div className={mismatch ? "font-medium text-amber-800" : "text-gray-700"}>{right}</div>
        </div>
    );
}

export default function CustomerMergeModal({
    open,
    onClose,
    onMerged,
    seedKeepId,
    seedMergeId,
}: CustomerMergeModalProps) {
    const [groups, setGroups] = useState<DupGroup[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [keepId, setKeepId] = useState<string>("");
    const [mergeId, setMergeId] = useState<string>("");
    const [merging, setMerging] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiFetch<{ data: DupGroup[] }>("/api/customers/duplicates");
            setGroups(res.data || []);
            if (seedKeepId && seedMergeId) {
                setKeepId(seedKeepId);
                setMergeId(seedMergeId);
            } else if (res.data?.[0]?.members?.length >= 2) {
                setKeepId(res.data[0].members[0]!.id);
                setMergeId(res.data[0].members[1]!.id);
            }
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Failed to load duplicates");
        } finally {
            setLoading(false);
        }
    }, [seedKeepId, seedMergeId]);

    useEffect(() => {
        if (open) void load();
    }, [open, load]);

    const allMembers = groups.flatMap((g) => g.members);
    const keep = allMembers.find((m) => m.id === keepId) || null;
    const merge = allMembers.find((m) => m.id === mergeId) || null;

    async function runMerge() {
        if (!keepId || !mergeId) {
            setError("Select keep and merge customers");
            return;
        }
        setMerging(true);
        setError(null);
        try {
            await apiFetch("/api/customers/merge", {
                method: "POST",
                body: { keep_id: keepId, merge_id: mergeId },
            });
            toast.success("Customers merged");
            onMerged();
            onClose();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Merge failed");
        } finally {
            setMerging(false);
        }
    }

    return (
        <ModalShell
            open={open}
            onClose={() => !merging && onClose()}
            title="Merge duplicate customers"
            description="Keep one record. Deals, leads, invoices, and follow-ups move to the keep customer; the duplicate is soft-deleted (Inactive)."
            size="3xl"
            error={error}
            titleIcon={<GitMerge className="h-5 w-5 text-blue-600" />}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={merging}>
                        Cancel
                    </Button>
                    <Button
                        onClick={() => void runMerge()}
                        disabled={merging || !keepId || !mergeId || keepId === mergeId}
                    >
                        {merging && <Loader2 className="h-4 w-4 animate-spin" />}
                        Merge into keep
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                        {loading ? "Scanning…" : `${groups.length} duplicate group(s) found`}
                    </p>
                    <Button variant="ghost" onClick={() => void load()} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        Rescan
                    </Button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-10 text-gray-500">
                        <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                ) : groups.length === 0 ? (
                    <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        No Active duplicates detected by email, phone, or name+contact.
                    </div>
                ) : (
                    <>
                        <div className="max-h-40 space-y-4 overflow-y-auto rounded-lg border border-gray-200 p-2">
                            {groups.map((g, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-blue-50"
                                    onClick={() => {
                                        setKeepId(g.members[0]!.id);
                                        setMergeId(g.members[1]!.id);
                                    }}
                                >
                                    <span className="font-medium text-gray-900">
                                        {g.members.map((m) => m.name).join(" · ")}
                                    </span>
                                    <span className="ml-2 text-xs text-gray-500">({g.reason})</span>
                                </button>
                            ))}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block space-y-1">
                                <span className="text-xs font-semibold uppercase text-emerald-700">
                                    Keep
                                </span>
                                <select
                                    className="w-full rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2 text-sm"
                                    value={keepId}
                                    onChange={(e) => setKeepId(e.target.value)}
                                >
                                    <option value="">Select…</option>
                                    {allMembers.map((m) => (
                                        <option key={`k-${m.id}`} value={m.id} disabled={m.id === mergeId}>
                                            {m.name} · {m.email || m.phone || m.id.slice(0, 8)}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="block space-y-1">
                                <span className="text-xs font-semibold uppercase text-amber-700">
                                    Merge (soft-delete)
                                </span>
                                <select
                                    className="w-full rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 text-sm"
                                    value={mergeId}
                                    onChange={(e) => setMergeId(e.target.value)}
                                >
                                    <option value="">Select…</option>
                                    {allMembers.map((m) => (
                                        <option key={`m-${m.id}`} value={m.id} disabled={m.id === keepId}>
                                            {m.name} · {m.email || m.phone || m.id.slice(0, 8)}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        {keep && merge && (
                            <div className="rounded-xl border border-gray-200 bg-white p-3">
                                <div className="grid grid-cols-[7rem_1fr_1fr] gap-2 border-b border-gray-200 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    <div>Field</div>
                                    <div className="text-emerald-700">Keep</div>
                                    <div className="text-amber-700">Merge away</div>
                                </div>
                                <Field label="Name" a={keep.name} b={merge.name} />
                                <Field label="Email" a={keep.email} b={merge.email} />
                                <Field label="Phone" a={keep.phone} b={merge.phone} />
                                <Field label="City" a={keep.city} b={merge.city} />
                                <Field label="Province" a={keep.province} b={merge.province} />
                                <Field label="Postal" a={keep.postal_code} b={merge.postal_code} />
                                <Field label="Status" a={keep.status} b={merge.status} />
                                <Field
                                    label="Created"
                                    a={keep.created_at?.slice(0, 10)}
                                    b={merge.created_at?.slice(0, 10)}
                                />
                            </div>
                        )}
                    </>
                )}
            </div>
        </ModalShell>
    );
}
