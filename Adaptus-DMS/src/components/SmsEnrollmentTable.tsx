"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/src/components/ui/Button";

export type SmsEnrollmentRow = {
    id: string;
    status: string;
    current_step: number;
    next_send_at: string | null;
    enrolled_at: string;
    lead_id: string | null;
    customer_id: string | null;
    sequence: { id: string; name: string } | null;
    customer: { id: string; name: string | null; phone: string | null } | null;
};

export function SmsEnrollmentTable({
    enrollments,
    showSequence = true,
    busyId,
    onSendNext,
}: {
    enrollments: SmsEnrollmentRow[];
    showSequence?: boolean;
    busyId: string | null;
    onSendNext: (id: string) => void;
}) {
    if (enrollments.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                Open a lead or customer with SMS consent, then enroll from a
                sequence. First send waits until due — no fake “Sent” status.
            </p>
        );
    }

    return (
        <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                        {showSequence && (
                            <th className="px-3 py-2 font-medium">Sequence</th>
                        )}
                        <th className="px-3 py-2 font-medium">Recipient</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 font-medium">Step</th>
                        <th className="px-3 py-2 font-medium">Enrolled</th>
                        <th className="px-3 py-2 font-medium"> </th>
                    </tr>
                </thead>
                <tbody>
                    {enrollments.map((e) => (
                        <tr
                            key={e.id}
                            className="border-b border-border last:border-0"
                        >
                            {showSequence && (
                                <td className="px-3 py-2">
                                    {e.sequence?.name || "—"}
                                </td>
                            )}
                            <td className="px-3 py-2">
                                {e.customer?.name ||
                                    e.customer?.phone ||
                                    (e.lead_id ? "Lead" : "—")}
                            </td>
                            <td className="px-3 py-2 capitalize">{e.status}</td>
                            <td className="px-3 py-2">
                                {e.current_step}
                                {e.next_send_at
                                    ? ` · next ${new Date(e.next_send_at).toLocaleDateString()}`
                                    : ""}
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">
                                {new Date(e.enrolled_at).toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-right">
                                {e.status === "active" && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={busyId === e.id}
                                        onClick={() => onSendNext(e.id)}
                                    >
                                        {busyId === e.id ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            "Send next"
                                        )}
                                    </Button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
