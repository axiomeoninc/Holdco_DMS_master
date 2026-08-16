"use client";

import { useEffect, useState } from "react";
import {
    User,
    Mail,
    Phone,
    MapPin,
    Save,
    UserPlus,
    Users,
    MessageSquare,
    Scan,
} from "lucide-react";
import OCRScannerModal from "./OCRScannerModal";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    useForm,
    zodResolver,
} from "@/src/components/ui/form";
import { ModalShell } from "@/src/components/ui/ModalShell";
import { Button } from "@/src/components/ui/Button";
import {
    customerFormSchema,
    type CustomerFormValues,
} from "@/src/lib/schemas/customer";
import { FieldHelp } from "@/src/components/ui/FieldHelp";

interface Customer {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    province: string | null;
    postal_code: string | null;
    notes: string | null;
    marketing_consent?: boolean | null;
    sms_consent?: boolean | null;
    marketing_consent_at?: string | null;
    sms_consent_at?: string | null;
    created_at: string;
    updated_at: string;
}

interface CustomerFormModalProps {
    mode: "add" | "edit";
    customer?: Customer | null;
    onClose: () => void;
    onSuccess: () => void;
    defaultName?: string;
    onSaved?: (customer: Customer) => void;
}

interface StaffUser {
    id: string;
    full_name: string;
    email: string;
    role: string;
}

const emptyValues = (defaultName?: string): CustomerFormValues => ({
    name: defaultName ?? "",
    email: "",
    phone: "",
    address: "",
    city: "",
    province: "",
    postal_code: "",
    notes: "",
    assigned_to: "",
    marketing_consent: false,
    sms_consent: false,
});

export default function CustomerFormModal({
    mode,
    customer,
    onClose,
    onSuccess,
    defaultName,
    onSaved,
}: CustomerFormModalProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showOCR, setShowOCR] = useState(false);
    const [users, setUsers] = useState<StaffUser[]>([]);
    const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

    const form = useForm<CustomerFormValues>({
        resolver: zodResolver(customerFormSchema),
        defaultValues: emptyValues(mode === "add" ? defaultName : undefined),
    });

    useEffect(() => {
        async function fetchData() {
            try {
                const meResponse = await fetch("/api/me");
                if (meResponse.ok) {
                    const meData = await meResponse.json();
                    setCurrentUserRole(meData.data?.role);

                    if (meData.data?.role === "Admin" || meData.data?.role === "Manager") {
                        const usersResponse = await fetch("/api/users");
                        if (usersResponse.ok) {
                            const usersData = await usersResponse.json();
                            setUsers(usersData.data || []);
                        }
                    }
                }
            } catch (err) {
                console.error("Error fetching data:", err);
            }
        }

        void fetchData();

        if (mode === "edit" && customer) {
            form.reset({
                name: customer.name,
                email: customer.email || "",
                phone: customer.phone || "",
                address: customer.address || "",
                city: customer.city || "",
                province: customer.province || "",
                postal_code: customer.postal_code || "",
                notes: customer.notes || "",
                assigned_to: (customer as { assigned_to?: string })?.assigned_to || "",
                marketing_consent: Boolean(customer.marketing_consent),
                sms_consent: Boolean(customer.sms_consent),
            });
        } else if (mode === "add") {
            form.reset(emptyValues(defaultName));
        }
    }, [mode, customer, defaultName, form]);

    async function onSubmit(formData: CustomerFormValues) {
        setLoading(true);
        setError(null);

        try {
            const url = mode === "add" ? "/api/customers" : `/api/customers/${customer?.id}`;
            const method = mode === "add" ? "POST" : "PATCH";

            const payload: Record<string, unknown> = {
                name: formData.name,
                email: formData.email || null,
                phone: formData.phone || null,
                address: formData.address || null,
                city: formData.city || null,
                province: formData.province || null,
                postal_code: formData.postal_code || null,
                notes: formData.notes || null,
                marketing_consent: Boolean(formData.marketing_consent),
                sms_consent: Boolean(formData.sms_consent),
            };

            if (formData.assigned_to) {
                payload.assigned_to = formData.assigned_to;
            }

            const response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to ${mode} customer`);
            }

            const result = await response.json().catch(() => null);
            if (result?.data && onSaved) {
                onSaved(result.data as Customer);
            }
            onSuccess();
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    }

    const inputClass =
        "w-full pl-10 pr-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent bg-card text-foreground";

    return (
        <>
            <ModalShell
                open
                onClose={onClose}
                title={mode === "add" ? "Add New Customer" : "Edit Customer"}
                description={
                    mode === "add"
                        ? "Add a new customer to your database"
                        : "Update customer information"
                }
                size="2xl"
                error={error}
                titleIcon={
                    mode === "add" ? (
                        <UserPlus className="h-5 w-5" />
                    ) : (
                        <Users className="h-5 w-5" />
                    )
                }
                footer={
                    <>
                        <Button variant="outline" onClick={onClose} disabled={loading}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            form="customer-form-modal"
                            variant="premium"
                            loading={loading}
                            leftIcon={<Save className="h-4 w-4" />}
                        >
                            {mode === "add" ? "Add Customer" : "Save Changes"}
                        </Button>
                    </>
                }
            >
                        <Form {...form}>
                            <form
                                id="customer-form-modal"
                                onSubmit={form.handleSubmit(onSubmit)}
                                className="space-y-5"
                            >
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <div className="mb-1.5 flex items-center justify-between">
                                                <FormLabel required>Full Name</FormLabel>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowOCR(true)}
                                                    className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-emerald-600 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
                                                >
                                                    <Scan className="h-3 w-3" />
                                                    Scan ID
                                                </button>
                                            </div>
                                            <FormControl>
                                                <div className="relative">
                                                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                    <input
                                                        {...field}
                                                        type="text"
                                                        className={inputClass}
                                                        placeholder="John Smith"
                                                    />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                                    <FormField
                                        control={form.control}
                                        name="email"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Email</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                        <input
                                                            {...field}
                                                            type="email"
                                                            className={inputClass}
                                                            placeholder="john@company.com"
                                                        />
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="phone"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Phone</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                        <input
                                                            {...field}
                                                            type="text"
                                                            className={inputClass}
                                                            placeholder="+1 234 567 8900"
                                                        />
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <FormField
                                    control={form.control}
                                    name="address"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Address</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                    <input
                                                        {...field}
                                                        type="text"
                                                        className={inputClass}
                                                        placeholder="123 Main Street"
                                                    />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-3">
                                    <FormField
                                        control={form.control}
                                        name="city"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>City</FormLabel>
                                                <FormControl>
                                                    <input
                                                        {...field}
                                                        type="text"
                                                        className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                                        placeholder="City"
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="province"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Province</FormLabel>
                                                <FormControl>
                                                    <input
                                                        {...field}
                                                        type="text"
                                                        className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                                        placeholder="Province"
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="postal_code"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Postal Code</FormLabel>
                                                <FormControl>
                                                    <input
                                                        {...field}
                                                        type="text"
                                                        className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                                        placeholder="A1B 2C3"
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <FormField
                                    control={form.control}
                                    name="notes"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Notes</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                    <textarea
                                                        {...field}
                                                        rows={3}
                                                        className="w-full resize-none rounded-lg border border-border bg-card py-2.5 pl-10 pr-4 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                                        placeholder="Additional notes about this customer..."
                                                    />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="space-y-4 rounded-lg border border-border bg-muted/40 p-4">
                                    <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                                        Communication consent (CASL)
                                        <FieldHelp
                                            label="CASL consent"
                                            text="Leave unchecked until the customer agrees. Checking stores a timestamp. Unchecked means do not send promotional email or SMS."
                                        />
                                    </p>
                                    <FormField
                                        control={form.control}
                                        name="marketing_consent"
                                        render={({ field }) => (
                                            <label className="flex cursor-pointer items-start gap-3">
                                                <input
                                                    type="checkbox"
                                                    checked={field.value}
                                                    onChange={(e) => field.onChange(e.target.checked)}
                                                    className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-ring"
                                                />
                                                <span className="text-sm text-foreground">
                                                    Marketing email consent
                                                    <span className="block text-xs text-muted-foreground">
                                                        Unchecked by default. Timestamp stored when checked.
                                                        {mode === "edit" && customer?.marketing_consent_at
                                                            ? ` Last recorded: ${new Date(customer.marketing_consent_at).toLocaleString()}.`
                                                            : ""}
                                                    </span>
                                                </span>
                                            </label>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="sms_consent"
                                        render={({ field }) => (
                                            <label className="flex cursor-pointer items-start gap-3">
                                                <input
                                                    type="checkbox"
                                                    checked={field.value}
                                                    onChange={(e) => field.onChange(e.target.checked)}
                                                    className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-ring"
                                                />
                                                <span className="text-sm text-foreground">
                                                    SMS / text consent
                                                    <span className="block text-xs text-muted-foreground">
                                                        Stored for CASL. SMS transport is not configured yet
                                                        (send API returns 501). Unchecked by default.
                                                        {mode === "edit" && customer?.sms_consent_at
                                                            ? ` Last recorded: ${new Date(customer.sms_consent_at).toLocaleString()}.`
                                                            : ""}
                                                    </span>
                                                </span>
                                            </label>
                                        )}
                                    />
                                </div>

                                {(currentUserRole === "Admin" || currentUserRole === "Manager") &&
                                    users.length > 0 && (
                                        <FormField
                                            control={form.control}
                                            name="assigned_to"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Assign To</FormLabel>
                                                    <FormControl>
                                                        <select
                                                            {...field}
                                                            className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                                        >
                                                            <option value="">Unassigned (Visible to all)</option>
                                                            {users.map((user) => (
                                                                <option key={user.id} value={user.id}>
                                                                    {user.full_name || user.email} ({user.role})
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </FormControl>
                                                    <p className="text-xs text-muted-foreground">
                                                        Assign this customer to a specific user. Unassigned
                                                        customers are visible to all.
                                                    </p>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    )}

                            </form>
                        </Form>
            </ModalShell>

            {showOCR && (
                <OCRScannerModal
                    onClose={() => setShowOCR(false)}
                    onScanComplete={(data) => {
                        if (data.first_name || data.last_name) {
                            const fullName = `${data.first_name || ""} ${data.last_name || ""}`.trim();
                            form.setValue("name", fullName || form.getValues("name"));
                            if (data.address) form.setValue("address", data.address);
                            if (data.city) form.setValue("city", data.city);
                            if (data.province) form.setValue("province", data.province);
                            if (data.postal_code) form.setValue("postal_code", data.postal_code);
                        }
                        setShowOCR(false);
                    }}
                    onCustomerCreated={(data) => {
                        if (data.first_name || data.last_name) {
                            form.setValue(
                                "name",
                                `${data.first_name || ""} ${data.last_name || ""}`.trim()
                            );
                        }
                    }}
                />
            )}
        </>
    );
}
