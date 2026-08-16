"use client";

import { useState, useEffect } from "react";
import {
    CheckSquare,
    Plus,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    Loader2,
    AlertCircle,
    Calendar,
    Clock,
    Circle,
    CheckCircle,
    AlertTriangle,
    Filter,
    FilterX,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import TaskFormModal from "@/src/components/TaskFormModal";
import TaskDetailsModal from "@/src/components/TaskDetailsModal";
import TasksKanban from "@/src/components/TasksKanban";
import ConfirmDialog from "@/src/components/ConfirmDialog";

import { toast } from "@/src/lib/toast";
import { ListPageShell } from "@/src/components/ListPageShell";
import { ListToolbar } from "@/src/components/ListToolbar";
import { MetricStrip } from "@/src/components/ui/MetricStrip";
import { Button } from "@/src/components/ui/Button";
import { SkeletonTable } from "@/src/components/ui/Skeleton";
import { cn } from "@/src/lib/utils";
import type { ListViewMode } from "@/src/components/ListToolbar";

interface UserData {
    id: string;
    full_name: string;
    email: string;
    avatar: string | null;
}

interface Task {
    id: string;
    title: string;
    description: string | null;
    assigned_to: string | null;
    created_by: string | null;
    due_date: string | null;
    reminder_at: string | null;
    priority: string;
    status: string;
    notes: string | null;
    tags: string[] | null;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
    source_type: string | null;
    source_id: string | null;
    assigned_user: UserData | null;
    created_by_user: UserData | null;
}

interface _TaskNote {
    id: string;
    content: string;
    is_internal: boolean;
    created_at: string;
    user: UserData | null;
}

interface ApiResponse {
    data: Task[];
    count: number;
    limit: number;
    offset: number;
}

interface FilterState {
    status: string;
    priority: string;
    assigned_to: string;
    due_date_from: string;
    due_date_to: string;
    my_tasks: boolean;
    overdue: boolean;
    search: string;
}

const TASK_STAGES = ["Pending", "In Progress", "Completed", "Cancelled", "On Hold"];

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string; icon: LucideIcon }> = {
    "Pending": { bg: "bg-warning-50", text: "text-warning", border: "border-yellow-200", icon: Clock },
    "In Progress": { bg: "bg-primary-50", text: "text-primary", border: "border-blue-200", icon: Circle },
    "Completed": { bg: "bg-success-50", text: "text-success", border: "border-green-200", icon: CheckCircle },
    "Cancelled": { bg: "bg-muted/40", text: "text-foreground/90", border: "border-border", icon: AlertTriangle },
    "On Hold": { bg: "bg-violet-50", text: "text-violet", border: "border-purple-200", icon: AlertTriangle }
};

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
    Low: { bg: "bg-muted", text: "text-foreground/90" },
    Medium: { bg: "bg-blue-100", text: "text-primary" },
    High: { bg: "bg-orange-100", text: "text-orange-700" },
    Urgent: { bg: "bg-red-100", text: "text-destructive" }
};

export default function TasksPage() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [itemsPerPage] = useState(20);
    const [viewMode, setViewMode] = useState<ListViewMode>("kanban");
    const [users, setUsers] = useState<UserData[]>([]);

    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState<FilterState>({
        status: "",
        priority: "",
        assigned_to: "",
        due_date_from: "",
        due_date_to: "",
        my_tasks: false,
        overdue: false,
        search: ""
    });

    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showFormModal, setShowFormModal] = useState(false);
    const [formMode, setFormMode] = useState<"add" | "edit">("add");
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);

    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [confirmDialogData, setConfirmDialogData] = useState<{ task: Task | null; loading: boolean }>({ task: null, loading: false });

    async function fetchUsers() {
        try {
            const response = await fetch("/api/users?limit=100", {
            });
            if (response.ok) {
                const data = await response.json();
                setUsers(data.data || []);
            }
        } catch (err) {
            console.error("Failed to fetch users:", err);
        }
    }

    async function fetchTasks() {
        try {
            setLoading(true);
            setError(null);
            const offset = (currentPage - 1) * itemsPerPage;

            let url = `/api/tasks?limit=${itemsPerPage}&offset=${offset}`;
            if (filters.status) url += `&status=${encodeURIComponent(filters.status)}`;
            if (filters.priority) url += `&priority=${encodeURIComponent(filters.priority)}`;
            if (filters.assigned_to) url += `&assigned_to=${encodeURIComponent(filters.assigned_to)}`;
            if (filters.my_tasks) url += `&my_tasks=true`;
            if (filters.overdue) url += `&overdue=true`;
            if (filters.due_date_from) url += `&due_date_from=${encodeURIComponent(filters.due_date_from)}`;
            if (filters.due_date_to) url += `&due_date_to=${encodeURIComponent(filters.due_date_to)}`;
            if (filters.search) url += `&q=${encodeURIComponent(filters.search)}`;

            const response = await fetch(url, {
            });

            if (!response.ok) throw new Error("Failed to fetch tasks");

            const data: ApiResponse = await response.json();
            setTasks(data.data);
            setTotalItems(data.count);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void fetchTasks();
        void fetchUsers();
    }, [currentPage, filters]);

    async function handleViewDetails(task: Task) {
        try {
            const response = await fetch(`/api/tasks/${task.id}`, {
            });
            if (response.ok) {
                const data = await response.json();
                setSelectedTask(data.data);
                setShowDetailsModal(true);
            }
        } catch (err) {
            console.error("Failed to fetch task details:", err);
        }
    }

    async function handleEdit(task: Task) {
        try {
            const response = await fetch(`/api/tasks/${task.id}`, {
            });
            if (response.ok) {
                const data = await response.json();
                setSelectedTask(data.data);
                setFormMode("edit");
                setShowFormModal(true);
            }
        } catch (err) {
            console.error("Failed to fetch task details:", err);
        }
    }

    const handleAdd = () => {
        setSelectedTask(null);
        setFormMode("add");
        setShowFormModal(true);
    };

    const handleFormSuccess = () => {
        setShowFormModal(false);
        setSelectedTask(null);
        fetchTasks();
    };

    const handleDelete = (task: Task) => {
        setConfirmDialogData({ task, loading: false });
        setShowConfirmDialog(true);
    };

    async function confirmDelete() {
        if (!confirmDialogData.task) return;

        const taskId = confirmDialogData.task.id;
        setConfirmDialogData((prev) => ({ ...prev, loading: true }));

        try {
            const response = await fetch(`/api/tasks/${taskId}`, {
                method: "DELETE"
            });

            if (!response.ok) throw new Error("Failed to delete task");

            setShowConfirmDialog(false);
            setConfirmDialogData({ task: null, loading: false });
            fetchTasks();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "An error occurred");
            setConfirmDialogData((prev) => ({ ...prev, loading: false }));
        }
    }

    async function handleStatusChange(task: Task, newStatus: string) {
        try {
            const response = await fetch(`/api/tasks/${task.id}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus })
            });

            if (!response.ok) throw new Error("Failed to update task status");
            fetchTasks();

            if (showDetailsModal && selectedTask?.id === task.id) {
                const detailsRes = await fetch(`/api/tasks/${task.id}`, {
                });
                if (detailsRes.ok) {
                    const data = await detailsRes.json();
                    setSelectedTask(data.data);
                }
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "An error occurred");
        }
    }

    const clearFilters = () => {
        setFilters({
            status: "",
            priority: "",
            assigned_to: "",
            due_date_from: "",
            due_date_to: "",
            my_tasks: false,
            overdue: false,
            search: ""
        });
        setCurrentPage(1);
    };

    const isOverdue = (task: Task) => {
        if (!task.due_date || task.status === "Completed" || task.status === "Cancelled") return false;
        return new Date(task.due_date) < new Date();
    };

    const formatDate = (date: string | null) => {
        if (!date) return "No due date";
        return new Date(date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric"
        });
    };

    const totalPages = Math.ceil(totalItems / itemsPerPage);

    const todoCount = tasks.filter((t) => t.status === "Pending").length;
    const inProgressCount = tasks.filter((t) => t.status === "In Progress").length;
    const completedCount = tasks.filter((t) => t.status === "Completed").length;
    const overdueCount = tasks.filter((t) => isOverdue(t)).length;

    const hasActiveFilters = filters.status || filters.priority || filters.assigned_to || filters.due_date_from || filters.due_date_to || filters.my_tasks || filters.overdue || filters.search;

    return (
        <ListPageShell
            title="Tasks"
            description="Manage and track your team's tasks"
            icon={CheckSquare}
            actions={
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={fetchTasks} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                    <Button size="sm" onClick={handleAdd}>
                        <Plus className="h-4 w-4" />
                        Add Task
                    </Button>
                </div>
            }
            kpis={
                <MetricStrip
                    loading={loading}
                    items={[
                        { label: "Pending", value: todoCount, tone: "warning" },
                        { label: "In Progress", value: inProgressCount },
                        { label: "Completed", value: completedCount, tone: "success" },
                        { label: "Overdue", value: overdueCount, tone: "destructive" },
                    ]}
                />
            }
            toolbar={
                <ListToolbar
                    searchPlaceholder="Search tasks..."
                    searchValue={filters.search}
                    onSearchChange={(v) => {
                        setFilters({ ...filters, search: v });
                        setCurrentPage(1);
                    }}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    showPrimary={false}
                    extraFilters={
                        <>
                            <button
                                type="button"
                                onClick={() => setShowFilters(!showFilters)}
                                className={cn(
                                    "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors",
                                    showFilters || hasActiveFilters
                                        ? "border-primary/30 bg-primary-50 text-primary"
                                        : "border-border bg-background text-foreground hover:bg-muted"
                                )}
                            >
                                <Filter className="h-3.5 w-3.5" />
                                Filters
                                {hasActiveFilters && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                            </button>
                            {hasActiveFilters && (
                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm text-foreground/80 hover:bg-muted"
                                >
                                    <FilterX className="h-3.5 w-3.5" /> Clear
                                </button>
                            )}
                        </>
                    }
                />
            }
        >
            {showFilters && (
                <div className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-card p-4 md:grid-cols-4 lg:grid-cols-6">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
                            <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                                <option value="">All</option>
                                {TASK_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Priority</label>
                            <select value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                                <option value="">All</option>
                                <option value="Low">Low</option>
                                <option value="Medium">Medium</option>
                                <option value="High">High</option>
                                <option value="Urgent">Urgent</option>
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Assigned To</label>
                            <select value={filters.assigned_to} onChange={(e) => setFilters({ ...filters, assigned_to: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                                <option value="">All</option>
                                {users.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Due From</label>
                            <input type="date" value={filters.due_date_from} onChange={(e) => setFilters({ ...filters, due_date_from: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Due To</label>
                            <input type="date" value={filters.due_date_to} onChange={(e) => setFilters({ ...filters, due_date_to: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                        </div>
                        <div className="flex items-end gap-2">
                            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 hover:bg-muted/40">
                                <input type="checkbox" checked={filters.my_tasks} onChange={(e) => setFilters({ ...filters, my_tasks: e.target.checked })} className="rounded border-input text-primary" />
                                <span className="text-sm">My Tasks</span>
                            </label>
                            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 hover:bg-muted/40">
                                <input type="checkbox" checked={filters.overdue} onChange={(e) => setFilters({ ...filters, overdue: e.target.checked })} className="rounded border-input text-primary" />
                                <span className="text-sm text-destructive">Overdue</span>
                            </label>
                        </div>
                </div>
            )}

            {/* Kanban View */}
            {viewMode === "kanban" ? (
                <TasksKanban
                    tasks={tasks}
                    loading={loading}
                    error={error}
                    onRefresh={fetchTasks}
                    onTaskClick={handleViewDetails}
                    onTaskEdit={handleEdit}
                    onTaskDelete={handleDelete}
                    onStatusChange={handleStatusChange}
                />
            ) : (
                /* Table View */
                <div className="bg-card rounded-xl border border-border overflow-hidden">
                    {/* Desktop Table - Hidden on mobile */}
                    <div className="hidden lg:block overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted/40 border-b border-border">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Task</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Priority</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Due Date</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Assigned To</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="p-6">
                                            <SkeletonTable rows={8} cols={6} />
                                        </td>
                                    </tr>
                                ) : error ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-12 text-center">
                                            <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
                                            <p className="mt-2 text-sm text-destructive">{error}</p>
                                            <button onClick={fetchTasks} className="mt-3 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary">Try Again</button>
                                        </td>
                                    </tr>
                                ) : tasks.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-12 text-center">
                                            <CheckSquare className="w-12 h-12 text-muted-foreground/50 mx-auto" />
                                            <p className="mt-2 text-sm text-muted-foreground">No tasks found</p>
                                            <button onClick={handleAdd} className="mt-3 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary">Add Your First Task</button>
                                        </td>
                                    </tr>
                                ) : (
                                    tasks.map((task) => {
                                        const overdue = isOverdue(task);
                                        return (
                                            <tr
                                                key={task.id}
                                                role="button"
                                                tabIndex={0}
                                                className={`cursor-pointer border-l-2 border-l-transparent transition-colors hover:border-l-primary hover:bg-muted/50 focus-visible:border-l-primary focus-visible:bg-muted/50 focus-visible:outline-none ${overdue ? "bg-destructive-50/30" : ""}`}
                                                onClick={() => handleViewDetails(task)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") handleViewDetails(task);
                                                }}
                                            >
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); handleStatusChange(task, task.status === "Completed" ? "Pending" : "Completed"); }}
                                                            className={`p-1 rounded ${task.status === "Completed" ? "text-success" : "text-muted-foreground/70 hover:text-success"}`}
                                                        >
                                                            {task.status === "Completed" ? <CheckCircle className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                                                        </button>
                                                        <div>
                                                            <button
                                                                type="button"
                                                                className={`text-left text-sm font-medium text-primary hover:underline underline-offset-2 ${task.status === "Completed" ? "line-through text-muted-foreground/70 no-underline" : ""}`}
                                                                onClick={(e) => { e.stopPropagation(); handleViewDetails(task); }}
                                                            >
                                                                {task.title}
                                                            </button>
                                                            {task.description && <p className="text-xs text-muted-foreground truncate max-w-[300px]">{task.description}</p>}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${PRIORITY_COLORS[task.priority]?.bg} ${PRIORITY_COLORS[task.priority]?.text}`}>
                                                        {task.priority}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[task.status]?.bg} ${STATUS_COLORS[task.status]?.text}`}>
                                                        {task.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`text-sm tabular-nums ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                                                        {task.due_date ? formatDate(task.due_date) : "—"}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        {task.assigned_user?.avatar ? (
                                                            <img src={task.assigned_user.avatar} alt="" className="w-6 h-6 rounded-full" />
                                                        ) : (
                                                            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-foreground/80 text-xs">
                                                                {task.assigned_user?.full_name?.[0] || "?"}
                                                            </div>
                                                        )}
                                                        <span className="text-sm text-foreground/80">{task.assigned_user?.full_name || "Unassigned"}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleEdit(task); }}
                                                            className="p-1.5 hover:bg-warning-50 rounded-lg"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDelete(task); }}
                                                            className="p-1.5 hover:bg-destructive-50 rounded-lg text-destructive"
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Cards - Hidden on desktop */}
                    <div className="lg:hidden divide-y divide-border">
                        {loading ? (
                            <div className="px-4 py-12 text-center">
                                <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
                                <p className="mt-2 text-sm text-muted-foreground">Loading tasks...</p>
                            </div>
                        ) : error ? (
                            <div className="px-4 py-12 text-center">
                                <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
                                <p className="mt-2 text-sm text-destructive">{error}</p>
                                <button onClick={fetchTasks} className="mt-3 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary">Try Again</button>
                            </div>
                        ) : tasks.length === 0 ? (
                            <div className="px-4 py-12 text-center">
                                <CheckSquare className="w-12 h-12 text-muted-foreground/50 mx-auto" />
                                <p className="mt-2 text-sm text-muted-foreground">No tasks found</p>
                                <button onClick={handleAdd} className="mt-3 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary">Add Your First Task</button>
                            </div>
                        ) : (
                            tasks.map((task) => {
                                const overdue = isOverdue(task);
                                return (
                                    <div key={task.id} className="p-4 hover:bg-muted/40 transition-colors">
                                        {/* Header Row */}
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => handleStatusChange(task, task.status === "Completed" ? "Pending" : "Completed")}
                                                    className={`p-1.5 rounded-full ${task.status === "Completed" ? "bg-green-100 text-success" : "bg-muted text-muted-foreground/70 hover:text-success"}`}
                                                >
                                                    {task.status === "Completed" ? <CheckCircle className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                                                </button>
                                                <div>
                                                    <p className={`text-sm font-medium ${task.status === "Completed" ? "line-through text-muted-foreground/70" : "text-foreground"}`}>
                                                        {task.title}
                                                    </p>
                                                    {task.description && (
                                                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">{task.description}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => handleEdit(task)}
                                                    className="p-1.5 hover:bg-warning-50 rounded-lg transition-colors"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(task)}
                                                    className="p-1.5 hover:bg-destructive-50 rounded-lg text-destructive transition-colors"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                        {/* Info Row - Badges */}
                                        <div className="flex flex-wrap items-center gap-2 mb-2">
                                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${PRIORITY_COLORS[task.priority]?.bg} ${PRIORITY_COLORS[task.priority]?.text}`}>
                                                {task.priority}
                                            </span>
                                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[task.status]?.bg} ${STATUS_COLORS[task.status]?.text}`}>
                                                {task.status}
                                            </span>
                                            {overdue && (
                                                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-destructive">
                                                    Overdue
                                                </span>
                                            )}
                                        </div>
                                        {/* Details Row - Grid */}
                                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                            <div className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3 text-muted-foreground/70" />
                                                <span className={overdue ? "text-destructive font-medium" : ""}>{formatDate(task.due_date)}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {task.assigned_user?.avatar ? (
                                                    <img src={task.assigned_user.avatar} alt="" className="w-4 h-4 rounded-full" />
                                                ) : (
                                                    <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-foreground/80 text-[8px]">
                                                        {task.assigned_user?.full_name?.[0] || "?"}
                                                    </div>
                                                )}
                                                <span>{task.assigned_user?.full_name || "Unassigned"}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Pagination */}
                    {!loading && !error && tasks.length > 0 && (
                        <div className="px-4 py-3 border-t border-border flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">
                                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} tasks
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                                    disabled={currentPage === 1}
                                    className="p-2 border border-border rounded-lg hover:bg-muted/40 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <span className="text-sm text-foreground/80">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <button
                                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                                    disabled={currentPage === totalPages}
                                    className="p-2 border border-border rounded-lg hover:bg-muted/40 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Modals */}
            {showDetailsModal && selectedTask && (
                <TaskDetailsModal
                    task={selectedTask}
                    users={users}
                    onClose={() => { setShowDetailsModal(false); setSelectedTask(null); }}
                    onEdit={() => { setShowDetailsModal(false); handleEdit(selectedTask); }}
                    onDelete={() => { setShowDetailsModal(false); handleDelete(selectedTask); }}
                    onStatusChange={handleStatusChange}
                    onRefresh={() => { if (selectedTask) handleViewDetails(selectedTask); }}
                />
            )}

            {showFormModal && (
                <TaskFormModal
                    mode={formMode}
                    task={selectedTask}
                    users={users}
                    onClose={() => { setShowFormModal(false); setSelectedTask(null); }}
                    onSuccess={handleFormSuccess}
                />
            )}

            {showConfirmDialog && confirmDialogData.task && (
                <ConfirmDialog
                    isOpen={showConfirmDialog}
                    title="Delete Task"
                    message={`Are you sure you want to delete "${confirmDialogData.task.title}"? This action cannot be undone.`}
                    confirmText={confirmDialogData.loading ? "Deleting..." : "Delete"}
                    variant="danger"
                    loading={confirmDialogData.loading}
                    onConfirm={confirmDelete}
                    onCancel={() => { setShowConfirmDialog(false); setConfirmDialogData({ task: null, loading: false }); }}
                />
            )}
        </ListPageShell>
    );
}