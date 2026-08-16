"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Link as LinkIcon, Plus, User, Car, FileText, Users, Calendar, DollarSign } from "lucide-react";
import { apiFetch } from "@/src/lib/fetch";
import { ModalShell } from "@/src/components/ui/ModalShell";
import { Button } from "@/src/components/ui/Button";

interface UserData {
    id: string;
    full_name: string;
    email: string;
    avatar: string | null;
}

interface Customer {
    id: string;
    name: string;
    email?: string;
    phone?: string;
}

interface Lead {
    id: string;
    status: string;
    customer?: Customer;
}

interface Vehicle {
    id: string;
    year: number;
    make: string;
    model: string;
    vin: string;
}

interface Deal {
    id: string;
    deal_status: string;
    vehicle?: Vehicle;
    customer?: Customer;
}

interface Invoice {
    id: string;
    invoice_number: string;
    total: number;
    status: string;
    customer?: Customer;
}

interface TestDrive {
    id: string;
    scheduled_date: string;
    vehicle?: Vehicle;
    customer?: Customer;
}

interface Task {
    id?: string;
    title: string;
    description?: string | null;
    assigned_to?: string | null;
    created_by?: string | null;
    due_date?: string | null;
    reminder_at?: string | null;
    priority?: string;
    status?: string;
    notes?: string | null;
    tags?: string[] | null;
    source_type?: string | null;
    source_id?: string | null;
    task_links?: TaskLink[];
}

interface TaskLink {
    link_type: string;
    linked_id: string;
    linked_label?: string;
}

interface TaskFormModalProps {
    mode: "add" | "edit";
    task?: Task | null;
    users?: UserData[];
    onClose: () => void;
    onSuccess: () => void;
}

const PRIORITIES = ["Low", "Medium", "High", "Urgent"];
const STATUSES = ["Pending", "In Progress", "Completed", "Cancelled", "On Hold"];

const LINK_TYPES = [
    { value: "customer", label: "Customer", icon: Users },
    { value: "lead", label: "Lead", icon: User },
    { value: "vehicle", label: "Vehicle", icon: Car },
    { value: "deal", label: "Deal", icon: DollarSign },
    { value: "invoice", label: "Invoice", icon: FileText },
    { value: "test_drive", label: "Test Drive", icon: Calendar },
];

export default function TaskFormModal({ mode, task, users = [], onClose, onSuccess }: TaskFormModalProps) {

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tags, setTags] = useState<string[]>(task?.tags || []);
    const [newTag, setNewTag] = useState("");
    const [links, setLinks] = useState<TaskLink[]>([]);
    const [showLinkForm, setShowLinkForm] = useState(false);
    const [newLinkType, setNewLinkType] = useState("customer");
    const [newLinkId, setNewLinkId] = useState("");
    const [loadingOptions, setLoadingOptions] = useState(false);

    // Data for dropdowns
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [leads, setLeads] = useState<Lead[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [deals, setDeals] = useState<Deal[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [testDrives, setTestDrives] = useState<TestDrive[]>([]);

    const [formData, setFormData] = useState({
        title: "",
        description: "",
        assigned_to: "",
        due_date: "",
        reminder_at: "",
        priority: "Medium",
        status: "Pending",
        notes: ""
    });

    useEffect(() => {
        console.log("Task changed:", JSON.stringify(task, null, 2));
        if (task) {
            setFormData({
                title: task.title || "",
                description: task.description || "",
                assigned_to: task.assigned_to || "",
                due_date: task.due_date ? task.due_date.split("T")[0] : "",
                reminder_at: task.reminder_at ? task.reminder_at.split("T")[0] : "",
                priority: task.priority || "Medium",
                status: task.status || "Pending",
                notes: task.notes || ""
            });
            setTags(task.tags || []);
            // Load existing links - reset first, then set if exists
            setLinks([]);
            console.log("task.task_links:", JSON.stringify(task.task_links, null, 2));
            if (task.task_links && task.task_links.length > 0) {
                const existingLinks: TaskLink[] = task.task_links.map((link) => ({
                    link_type: link.link_type,
                    linked_id: link.linked_id,
                    linked_label: `${link.link_type}: ${link.linked_id.slice(0, 8)}...`
                }));
                console.log("Setting existing links:", JSON.stringify(existingLinks, null, 2));
                setLinks(existingLinks);
            }
        } else {
            setLinks([]);
        }
    }, [task]);

    async function fetchAllLinkData() {
        try {
            const [custRes, leadRes, vehRes, dealRes, invRes, tdRes] = await Promise.all([
                apiFetch<{ data: Customer[] }>("/api/customers?limit=100"),
                apiFetch<{ data: Lead[] }>("/api/leads?limit=100"),
                apiFetch<{ data: Vehicle[] }>("/api/vehicles?limit=100"),
                apiFetch<{ data: Deal[] }>("/api/deals?limit=100"),
                apiFetch<{ data: Invoice[] }>("/api/invoices?limit=100"),
                apiFetch<{ data: TestDrive[] }>("/api/test-drives?limit=100"),
            ]);

            setCustomers(custRes.data || []);
            setLeads(leadRes.data || []);
            setVehicles(vehRes.data || []);
            setDeals(dealRes.data || []);
            setInvoices(invRes.data || []);
            setTestDrives(tdRes.data || []);

            // Update link labels after fetching all data
            setLinks(prevLinks =>
                prevLinks.map(link => ({
                    ...link,
                    linked_label: getLinkLabel(link.link_type, link.linked_id)
                }))
            );
        } catch (err) {
            console.error("Failed to fetch link data:", err);
        }
    }

    async function fetchLinkOptions() {
        setLoadingOptions(true);

        try {
            switch (newLinkType) {
                case "customer":
                    const custRes = await apiFetch<{ data: Customer[] }>("/api/customers?limit=100");
                    setCustomers(custRes.data || []);
                    break;
                case "lead":
                    const leadRes = await apiFetch<{ data: Lead[] }>("/api/leads?limit=100");
                    setLeads(leadRes.data || []);
                    break;
                case "vehicle":
                    const vehRes = await apiFetch<{ data: Vehicle[] }>("/api/vehicles?limit=100");
                    setVehicles(vehRes.data || []);
                    break;
                case "deal":
                    const dealRes = await apiFetch<{ data: Deal[] }>("/api/deals?limit=100");
                    setDeals(dealRes.data || []);
                    break;
                case "invoice":
                    const invRes = await apiFetch<{ data: Invoice[] }>("/api/invoices?limit=100");
                    setInvoices(invRes.data || []);
                    break;
                case "test_drive":
                    const tdRes = await apiFetch<{ data: TestDrive[] }>("/api/test-drives?limit=100");
                    setTestDrives(tdRes.data || []);
                    break;
            }
        } catch (err) {
            console.error("Failed to fetch link options:", err);
        } finally {
            setLoadingOptions(false);
        }
    }
    // Fetch all data when modal opens (for dropdowns and link labels)
    useEffect(() => {
        async function loadData() {
            await fetchAllLinkData();
        }
        loadData();
    }, []); // Re-run when task changes

    // Fetch data when link type changes
    useEffect(() => {
        if (showLinkForm) {
            fetchLinkOptions();
        }
    }, [newLinkType, showLinkForm]);

    const getLinkLabel = (type: string, id: string): string => {
        switch (type) {
            case "customer": {
                const c = customers.find(x => x.id === id);
                return c ? c.name : id.slice(0, 8);
            }
            case "lead": {
                const l = leads.find(x => x.id === id);
                return l ? `Lead: ${l.customer?.name || id.slice(0, 8)}` : id.slice(0, 8);
            }
            case "vehicle": {
                const v = vehicles.find(x => x.id === id);
                return v ? `${v.year} ${v.make} ${v.model}` : id.slice(0, 8);
            }
            case "deal": {
                const d = deals.find(x => x.id === id);
                return d ? `Deal: ${d.vehicle?.make || id.slice(0, 8)}` : id.slice(0, 8);
            }
            case "invoice": {
                const i = invoices.find(x => x.id === id);
                return i ? `Invoice #${i.invoice_number}` : id.slice(0, 8);
            }
            case "test_drive": {
                const td = testDrives.find(x => x.id === id);
                return td ? `Test Drive: ${td.vehicle?.make || id.slice(0, 8)}` : id.slice(0, 8);
            }
            default:
                return id.slice(0, 8);
        }
    };

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!formData.title.trim()) {
            setError("Title is required");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const payload: Record<string, unknown> = {
                title: formData.title.trim(),
                description: formData.description.trim() || null,
                assigned_to: formData.assigned_to || null,
                due_date: formData.due_date ? new Date(formData.due_date).toISOString() : null,
                reminder_at: formData.reminder_at ? new Date(formData.reminder_at).toISOString() : null,
                priority: formData.priority,
                status: formData.status,
                notes: formData.notes.trim() || null,
                tags: tags
            };

            console.log("Current links state at submit:", JSON.stringify(links, null, 2));
            if (links.length > 0) {
                payload.links = links;
            }

            console.log("Submitting payload:", JSON.stringify(payload, null, 2));

            const url = mode === "edit" && task?.id ? `/api/tasks/${task.id}` : "/api/tasks";
            const method = mode === "edit" ? "PATCH" : "POST";

            await apiFetch(url, {
                method,
                body: payload
            });

            onSuccess();
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    }

    const addTag = () => {
        if (newTag.trim() && !tags.includes(newTag.trim())) {
            setTags([...tags, newTag.trim()]);
            setNewTag("");
        }
    };

    const removeTag = (tag: string) => {
        setTags(tags.filter((t) => t !== tag));
    };

    const addLink = () => {
        if (newLinkType && newLinkId) {
            const label = getLinkLabel(newLinkType, newLinkId);
            const newLink = { link_type: newLinkType, linked_id: newLinkId, linked_label: label };
            console.log("Adding link:", newLink);
            console.log("Current links before:", JSON.stringify(links));
            setLinks(prevLinks => {
                const updated = [...prevLinks, newLink];
                console.log("Links after set:", JSON.stringify(updated));
                return updated;
            });
            setNewLinkId("");
            setShowLinkForm(false);
        }
    };

    const removeLink = (index: number) => {
        console.log("Removing link at index:", index);
        console.log("Links before remove:", JSON.stringify(links));
        setLinks(prevLinks => {
            const updated = prevLinks.filter((_, i) => i !== index);
            console.log("Links after remove:", JSON.stringify(updated));
            return updated;
        });
    };

    const LinkTypeIcon = LINK_TYPES.find(t => t.value === newLinkType)?.icon || LinkIcon;

    const renderDropdown = () => {
        switch (newLinkType) {
            case "customer":
                return (
                    <select
                        value={newLinkId}
                        onChange={(e) => setNewLinkId(e.target.value)}
                        className="flex-1 px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                    >
                        <option value="">Select a customer</option>
                        {customers.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name} {c.email ? `(${c.email})` : ""}
                            </option>
                        ))}
                    </select>
                );
            case "lead":
                return (
                    <select
                        value={newLinkId}
                        onChange={(e) => setNewLinkId(e.target.value)}
                        className="flex-1 px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                    >
                        <option value="">Select a lead</option>
                        {leads.map((l) => (
                            <option key={l.id} value={l.id}>
                                {l.customer?.name || "Unknown"} - {l.status}
                            </option>
                        ))}
                    </select>
                );
            case "vehicle":
                return (
                    <select
                        value={newLinkId}
                        onChange={(e) => setNewLinkId(e.target.value)}
                        className="flex-1 px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                    >
                        <option value="">Select a vehicle</option>
                        {vehicles.map((v) => (
                            <option key={v.id} value={v.id}>
                                {v.year} {v.make} {v.model} - {v.vin}
                            </option>
                        ))}
                    </select>
                );
            case "deal":
                return (
                    <select
                        value={newLinkId}
                        onChange={(e) => setNewLinkId(e.target.value)}
                        className="flex-1 px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                    >
                        <option value="">Select a deal</option>
                        {deals.map((d) => (
                            <option key={d.id} value={d.id}>
                                Deal - {d.vehicle?.make} {d.vehicle?.model} ({d.deal_status})
                            </option>
                        ))}
                    </select>
                );
            case "invoice":
                return (
                    <select
                        value={newLinkId}
                        onChange={(e) => setNewLinkId(e.target.value)}
                        className="flex-1 px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                    >
                        <option value="">Select an invoice</option>
                        {invoices.map((i) => (
                            <option key={i.id} value={i.id}>
                                Invoice #{i.invoice_number} - ${i.total} ({i.status})
                            </option>
                        ))}
                    </select>
                );
            case "test_drive":
                return (
                    <select
                        value={newLinkId}
                        onChange={(e) => setNewLinkId(e.target.value)}
                        className="flex-1 px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                    >
                        <option value="">Select a test drive</option>
                        {testDrives.map((td) => (
                            <option key={td.id} value={td.id}>
                                {td.vehicle?.make} {td.vehicle?.model} - {new Date(td.scheduled_date).toLocaleDateString()}
                            </option>
                        ))}
                    </select>
                );
            default:
                return (
                    <input
                        type="text"
                        value={newLinkId}
                        onChange={(e) => setNewLinkId(e.target.value)}
                        placeholder="Enter ID"
                        className="flex-1 px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                    />
                );
        }
    };

    return (
        <ModalShell
            open
            onClose={onClose}
            title={mode === "add" ? "Create New Task" : "Edit Task"}
            size="2xl"
            error={error}
            footer={
                <>
                    <Button variant="outline" onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button type="submit" form="task-form-modal" variant="premium" loading={loading}>
                        {mode === "add" ? "Create Task" : "Save Changes"}
                    </Button>
                </>
            }
        >
            <form id="task-form-modal" onSubmit={handleSubmit} className="space-y-4">


                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                            Title <span className="text-destructive">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder="Enter task title"
                            className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Description</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Enter task description"
                            rows={3}
                            className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                        />
                    </div>

                    {/* Priority & Status */}
                    <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1">Priority</label>
                            <select
                                value={formData.priority}
                                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1">Status</label>
                            <select
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Assigned To */}
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Assigned To</label>
                        <select
                            value={formData.assigned_to}
                            onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                            className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                            <option value="">Select a user</option>
                            {users.map((user) => (
                                <option key={user.id} value={user.id}>{user.full_name || user.email}</option>
                            ))}
                        </select>
                    </div>

                    {/* Due Date & Reminder */}
                    <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1">Due Date</label>
                            <input
                                type="date"
                                value={formData.due_date}
                                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1">Reminder Date</label>
                            <input
                                type="date"
                                value={formData.reminder_at}
                                onChange={(e) => setFormData({ ...formData, reminder_at: e.target.value })}
                                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                        </div>
                    </div>

                    {/* Tags */}
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Tags</label>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {tags.map((tag) => (
                                <span key={tag} className="px-2 py-1 bg-blue-100 text-primary text-sm rounded-lg flex items-center gap-1">
                                    {tag}
                                    <button type="button" onClick={() => removeTag(tag)} className="hover:text-blue-900">
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newTag}
                                onChange={(e) => setNewTag(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                                placeholder="Add a tag"
                                className="flex-1 px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                            />
                            <button type="button" onClick={addTag} className="px-3 py-2 bg-muted text-foreground rounded-lg hover:bg-muted">
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Links - Related To */}
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Related To</label>
                        {links.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2">
                                {links.map((link, index) => {
                                    // Find the proper label based on link type and id
                                    let displayLabel = link.linked_id.slice(0, 8);
                                    switch (link.link_type) {
                                        case "customer": {
                                            const c = customers.find(x => x.id === link.linked_id);
                                            displayLabel = c?.name || link.linked_id.slice(0, 8);
                                            break;
                                        }
                                        case "lead": {
                                            const l = leads.find(x => x.id === link.linked_id);
                                            displayLabel = l?.customer?.name || `Lead ${link.linked_id.slice(0, 8)}`;
                                            break;
                                        }
                                        case "vehicle": {
                                            const v = vehicles.find(x => x.id === link.linked_id);
                                            displayLabel = v ? `${v.year} ${v.make} ${v.model}` : link.linked_id.slice(0, 8);
                                            break;
                                        }
                                        case "deal": {
                                            const d = deals.find(x => x.id === link.linked_id);
                                            displayLabel = d ? `Deal - ${d.vehicle?.make || 'Unknown'}` : link.linked_id.slice(0, 8);
                                            break;
                                        }
                                        case "invoice": {
                                            const i = invoices.find(x => x.id === link.linked_id);
                                            displayLabel = i ? `Invoice #${i.invoice_number}` : link.linked_id.slice(0, 8);
                                            break;
                                        }
                                        case "test_drive": {
                                            const td = testDrives.find(x => x.id === link.linked_id);
                                            displayLabel = td ? `Test Drive - ${td.vehicle?.make || 'Unknown'}` : link.linked_id.slice(0, 8);
                                            break;
                                        }
                                    }
                                    return (
                                        <span key={index} className="px-2 py-1 bg-purple-100 text-purple-700 text-sm rounded-lg flex items-center gap-1">
                                            <LinkIcon className="w-3 h-3" />
                                            {link.link_type}: {displayLabel}
                                            <button type="button" onClick={() => removeLink(index)} className="hover:text-purple-900">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </span>
                                    );
                                })}
                            </div>
                        )}
                        {showLinkForm ? (
                            <div className="space-y-2">
                                <div className="flex gap-2">
                                    <div className="relative">
                                        <select
                                            value={newLinkType}
                                            onChange={(e) => { setNewLinkType(e.target.value); setNewLinkId(""); }}
                                            className="pl-10 pr-8 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-sm appearance-none bg-card"
                                        >
                                            {LINK_TYPES.map((t) => (
                                                <option key={t.value} value={t.value}>{t.label}</option>
                                            ))}
                                        </select>
                                        <LinkTypeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    {loadingOptions ? (
                                        <div className="flex-1 px-3 py-2 border border-border rounded-lg flex items-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                            <span className="text-sm text-muted-foreground">Loading...</span>
                                        </div>
                                    ) : (
                                        renderDropdown()
                                    )}
                                    <button
                                        type="button"
                                        onClick={addLink}
                                        disabled={!newLinkId || loadingOptions}
                                        className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
                                    >
                                        Add
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setShowLinkForm(false); setNewLinkId(""); }}
                                        className="px-3 py-2 bg-muted text-foreground rounded-lg hover:bg-muted"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setShowLinkForm(true)}
                                className="flex items-center gap-2 px-3 py-2 border border-border border-dashed rounded-lg text-muted-foreground hover:bg-muted w-full justify-center"
                            >
                                <LinkIcon className="w-4 h-4" /> Add Link
                            </button>
                        )}
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Additional notes"
                            rows={2}
                            className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                        />
                    </div>
            </form>
        </ModalShell>
    );
}
