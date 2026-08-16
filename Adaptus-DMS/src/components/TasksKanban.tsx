"use client";

import React, { useState } from 'react';
import {
    Edit,
    Trash2,
    Calendar,
    Clock,
    CheckCircle,
    Circle,
    AlertTriangle,
    GripVertical,
    Loader2,
    AlertCircle,
    MessageSquare,
    XCircle,
    CheckSquare,
} from 'lucide-react';

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
    task_notes?: unknown[];
    task_attachments?: unknown[];
    task_reminders?: unknown[];
    task_links?: unknown[];
}

interface TasksKanbanProps {
    tasks: Task[];
    loading: boolean;
    error: string | null;
    onRefresh: () => void;
    onTaskClick: (task: Task) => void;
    onTaskEdit: (task: Task) => void;
    onTaskDelete: (task: Task) => void;
    onStatusChange: (task: Task, newStatus: string) => void;
}

interface Column {
    id: string;
    title: string;
    icon: React.ElementType;
    color: string;
    bgColor: string;
    borderColor: string;
    iconColor: string;
    status: string;
}

const TasksKanban: React.FC<TasksKanbanProps> = ({
    tasks,
    loading,
    error,
    onRefresh,
    onTaskClick,
    onTaskEdit,
    onTaskDelete,
    onStatusChange
}) => {
    const [draggedTask, setDraggedTask] = useState<Task | null>(null);
    const [updating, setUpdating] = useState(false);
    const [optimisticTasks, setOptimisticTasks] = useState<Task[]>(tasks);

    React.useEffect(() => {
        setOptimisticTasks(tasks);
    }, [tasks]);

    const columns: Column[] = [
        {
            id: 'pending',
            title: 'Pending',
            icon: Clock,
            color: 'text-yellow-600',
            bgColor: 'bg-yellow-50',
            borderColor: 'border-yellow-200',
            iconColor: 'text-yellow-500',
            status: 'Pending'
        },
        {
            id: 'in_progress',
            title: 'In Progress',
            icon: Circle,
            color: 'text-blue-600',
            bgColor: 'bg-blue-50',
            borderColor: 'border-blue-200',
            iconColor: 'text-blue-500',
            status: 'In Progress'
        },
        {
            id: 'completed',
            title: 'Completed',
            icon: CheckCircle,
            color: 'text-green-600',
            bgColor: 'bg-green-50',
            borderColor: 'border-green-200',
            iconColor: 'text-green-500',
            status: 'Completed'
        },
        {
            id: 'cancelled',
            title: 'Cancelled',
            icon: XCircle,
            color: 'text-muted-foreground',
            bgColor: 'bg-muted/40',
            borderColor: 'border-gray-200',
            iconColor: 'text-muted-foreground',
            status: 'Cancelled'
        },
        {
            id: 'on_hold',
            title: 'On Hold',
            icon: AlertTriangle,
            color: 'text-purple-600',
            bgColor: 'bg-purple-50',
            borderColor: 'border-purple-200',
            iconColor: 'text-purple-500',
            status: 'On Hold'
        },
    ];

    const priorityColors: Record<string, string> = {
        Low: 'bg-muted text-foreground/80',
        Medium: 'bg-blue-100 text-blue-700',
        High: 'bg-orange-100 text-orange-700',
        Urgent: 'bg-red-100 text-red-700'
    };

    const getTasksByStatus = (status: string) => {
        return optimisticTasks.filter((task) => task.status === status);
    };

    const isOverdue = (task: Task) => {
        if (!task.due_date || task.status === 'Completed' || task.status === 'Cancelled') return false;
        return new Date(task.due_date) < new Date();
    };

    const handleDragStart = (e: React.DragEvent, task: Task) => {
        setDraggedTask(task);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    async function handleDrop(e: React.DragEvent, targetStatus: string) {
        e.preventDefault();

        if (!draggedTask || draggedTask.status === targetStatus) {
            setDraggedTask(null);
            return;
        }

        // Optimistic update
        const updatedTask = { ...draggedTask, status: targetStatus };
        setOptimisticTasks((prev) =>
            prev.map((task) =>
                task.id === draggedTask.id ? updatedTask : task
            )
        );
        setDraggedTask(null);
        setUpdating(true);

        try {
            onStatusChange(draggedTask, targetStatus);
        } catch (error) {
            console.error('Failed to update task status:', error);
            setOptimisticTasks(tasks);
        } finally {
            setUpdating(false);
        }
    }

    const formatDate = (date: string | null) => {
        if (!date) return null;
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px] bg-white rounded-xl border border-gray-200">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                    <p className="text-sm text-muted-foreground">Loading tasks...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-[400px] bg-white rounded-xl border border-gray-200">
                <div className="text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                    <p className="text-sm text-red-600">{error}</p>
                    <button
                        onClick={onRefresh}
                        className="mt-3 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full">
            {/* Desktop Kanban View - Hidden on mobile */}
            <div className="hidden lg:block">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {columns.map((column) => {
                    const columnTasks = getTasksByStatus(column.status);
                    const ColumnIcon = column.icon;

                    return (
                        <div
                            key={column.id}
                            className={`rounded-lg ${column.bgColor} ${column.borderColor} border p-3 flex flex-col min-h-[400px] transition-colors ${updating ? 'opacity-70' : ''}`}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, column.status)}
                        >
                            {/* Column Header */}
                            <div className="flex items-center justify-between p-2 rounded-t-lg">
                                <div className="flex items-center gap-2">
                                    <ColumnIcon size={18} className={column.iconColor} />
                                    <h3 className="font-semibold text-foreground/80 text-sm">{column.title}</h3>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${column.color} bg-white`}>
                                        {columnTasks.length}
                                    </span>
                                </div>
                                {updating && (
                                    <Loader2 size={14} className="text-blue-500 animate-spin" />
                                )}
                            </div>

                            {/* Column Content */}
                            <div
                                className="mt-3 space-y-3 flex-1 overflow-y-auto"
                                style={{ maxHeight: 'calc(100vh - 300px)' }}
                            >
                                {columnTasks.map((task) => (
                                    <div
                                        key={task.id}
                                        draggable={!updating}
                                        onDragStart={(e) => handleDragStart(e, task)}
                                        onClick={() => onTaskClick(task)}
                                        className={`bg-white rounded-lg shadow-sm border hover:shadow-md transition-all cursor-grab active:cursor-grabbing ${isOverdue(task) ? 'border-red-300 bg-red-50/50' : 'border-gray-200 hover:border-blue-300'}`}
                                    >
                                        <div className="p-3">
                                            {/* Drag Handle & Actions */}
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2 text-muted-foreground/70">
                                                    <GripVertical size={14} />
                                                    <span className="text-xs font-mono truncate max-w-[80px] text-muted-foreground">
                                                        #{task.id.slice(0, 8)}
                                                    </span>
                                                </div>
                                                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                                    <button
                                                        onClick={() => onTaskEdit(task)}
                                                        className="p-1 text-muted-foreground/70 hover:text-amber-600 transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Edit size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => onTaskDelete(task)}
                                                        className="p-1 text-muted-foreground/70 hover:text-red-600 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Task Title */}
                                            <h4 className="font-semibold text-foreground text-sm mb-2 line-clamp-2">
                                                {task.title}
                                            </h4>

                                            {/* Description */}
                                            {task.description && (
                                                <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                                                    {task.description}
                                                </p>
                                            )}

                                            {/* Priority & Due Date */}
                                            <div className="flex items-center justify-between mb-2">
                                                <span className={`px-2 py-0.5 text-xs font-medium rounded ${priorityColors[task.priority] || 'bg-muted text-foreground/80'}`}>
                                                    {task.priority}
                                                </span>
                                                {task.due_date && (
                                                    <div className={`flex items-center gap-1 text-xs ${isOverdue(task) ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                                                        <Calendar size={12} />
                                                        {formatDate(task.due_date)}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Tags */}
                                            {task.tags && task.tags.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mb-2">
                                                    {task.tags.slice(0, 3).map((tag, i) => (
                                                        <span key={i} className="px-1.5 py-0.5 text-[10px] bg-blue-50 text-blue-700 rounded">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                    {task.tags.length > 3 && (
                                                        <span className="px-1.5 py-0.5 text-[10px] bg-muted text-muted-foreground rounded">
                                                            +{task.tags.length - 3}
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {/* Assigned User & Notes Count */}
                                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                                                <div className="flex items-center gap-2">
                                                    {task.assigned_user?.avatar ? (
                                                        <img
                                                            src={task.assigned_user.avatar}
                                                            alt=""
                                                            className="w-5 h-5 rounded-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-medium">
                                                            {task.assigned_user?.full_name?.[0] || '?'}
                                                        </div>
                                                    )}
                                                    <span className="text-xs text-muted-foreground truncate max-w-[80px]">
                                                        {task.assigned_user?.full_name?.split(' ')[0] || 'Unassigned'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1 text-muted-foreground/70">
                                                    {task.task_notes && task.task_notes.length > 0 && (
                                                        <div className="flex items-center gap-1">
                                                            <MessageSquare size={12} />
                                                            <span className="text-xs">{task.task_notes.length}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {/* Empty State */}
                                {columnTasks.length === 0 && (
                                    <div className="bg-muted/40 rounded-lg border border-dashed border-border p-6 text-center">
                                        <ColumnIcon size={24} className={`mx-auto mb-2 ${column.iconColor} opacity-50`} />
                                        <p className="text-xs text-muted-foreground/70">No tasks</p>
                                        <p className="text-xs text-muted-foreground/70">Drop here to move</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
            </div>

            {/* Mobile List View - Hidden on desktop */}
            <div className="lg:hidden space-y-3">
                {loading ? (
                    <div className="flex items-center justify-center min-h-[300px] bg-white rounded-xl border border-gray-200">
                        <div className="flex flex-col items-center gap-4">
                            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                            <p className="text-sm text-muted-foreground">Loading tasks...</p>
                        </div>
                    </div>
                ) : error ? (
                    <div className="flex items-center justify-center min-h-[300px] bg-white rounded-xl border border-gray-200">
                        <div className="text-center">
                            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                            <p className="text-sm text-red-600">{error}</p>
                            <button
                                onClick={onRefresh}
                                className="mt-3 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                Try Again
                            </button>
                        </div>
                    </div>
                ) : tasks.length === 0 ? (
                    <div className="flex items-center justify-center min-h-[300px] bg-white rounded-xl border border-gray-200">
                        <div className="text-center">
                            <CheckSquare className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                            <p className="text-sm text-muted-foreground">No tasks found</p>
                        </div>
                    </div>
                ) : (
                    optimisticTasks.map((task) => {
                        const taskColumn = columns.find(col => col.status === task.status);
                        const ColumnIcon = taskColumn?.icon || Clock;
                        return (
                            <div
                                key={task.id}
                                onClick={() => onTaskClick(task)}
                                className={`bg-white rounded-lg border p-4 hover:shadow-md transition-all cursor-pointer ${isOverdue(task) ? 'border-red-300 bg-red-50/50' : 'border-gray-200 hover:border-blue-300'}`}
                            >
                                {/* Header Row */}
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <ColumnIcon size={16} className={taskColumn?.iconColor || 'text-muted-foreground/70'} />
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${taskColumn?.bgColor || 'bg-muted'} ${taskColumn?.color || 'text-muted-foreground'}`}>
                                            {task.status}
                                        </span>
                                    </div>
                                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            onClick={() => onTaskEdit(task)}
                                            className="p-1 text-muted-foreground/70 hover:text-amber-600 transition-colors"
                                        >
                                            <Edit size={14} />
                                        </button>
                                        <button
                                            onClick={() => onTaskDelete(task)}
                                            className="p-1 text-muted-foreground/70 hover:text-red-600 transition-colors"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                                {/* Task Title */}
                                <h4 className="font-semibold text-foreground text-sm mb-2">
                                    {task.title}
                                </h4>
                                {/* Description */}
                                {task.description && (
                                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                                        {task.description}
                                    </p>
                                )}
                                {/* Info Row - Badges */}
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${priorityColors[task.priority] || 'bg-muted text-foreground/80'}`}>
                                        {task.priority}
                                    </span>
                                    {task.due_date && (
                                        <div className={`flex items-center gap-1 text-xs ${isOverdue(task) ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                                            <Calendar size={12} />
                                            {formatDate(task.due_date)}
                                        </div>
                                    )}
                                </div>
                                {/* Tags */}
                                {task.tags && task.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mb-2">
                                        {task.tags.slice(0, 3).map((tag, i) => (
                                            <span key={i} className="px-1.5 py-0.5 text-[10px] bg-blue-50 text-blue-700 rounded">
                                                {tag}
                                            </span>
                                        ))}
                                        {task.tags.length > 3 && (
                                            <span className="px-1.5 py-0.5 text-[10px] bg-muted text-muted-foreground rounded">
                                                +{task.tags.length - 3}
                                            </span>
                                        )}
                                    </div>
                                )}
                                {/* Assigned User */}
                                <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                                    {task.assigned_user?.avatar ? (
                                        <img src={task.assigned_user.avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                                    ) : (
                                        <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-medium">
                                            {task.assigned_user?.full_name?.[0] || '?'}
                                        </div>
                                    )}
                                    <span className="text-xs text-muted-foreground truncate">
                                        {task.assigned_user?.full_name || 'Unassigned'}
                                    </span>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default TasksKanban;
