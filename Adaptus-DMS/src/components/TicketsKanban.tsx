"use client";

import React, { useState } from 'react';
import {
    Edit,
    Trash2,
    Clock,
    AlertCircle,
    CheckCircle,
    XCircle,
    GripVertical,
    Loader2,
} from 'lucide-react';

interface TicketUser {
    id: string;
    full_name: string;
    email: string;
    avatar: string | null;
}

interface Ticket {
    id: string;
    subject: string;
    description: string | null;
    assigned_to: string | null;
    created_by: string | null;
    priority: string;
    status: string;
    resolved_at: string | null;
    created_at: string;
    assigned_user: TicketUser | null;
    created_by_user: TicketUser | null;
}

interface TicketsKanbanProps {
    tickets: Ticket[];
    loading: boolean;
    error: string | null;
    onRefresh: () => void;
    onTicketClick: (ticket: Ticket) => void;
    onTicketEdit: (ticket: Ticket) => void;
    onTicketDelete: (ticket: Ticket) => void;
    onStatusChange: (ticket: Ticket, newStatus: string) => void;
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

const TicketsKanban: React.FC<TicketsKanbanProps> = ({
    tickets,
    loading,
    error,
    onRefresh,
    onTicketClick,
    onTicketEdit,
    onTicketDelete,
    onStatusChange
}) => {
    const [draggedTicket, setDraggedTicket] = useState<Ticket | null>(null);
    const [updating, setUpdating] = useState(false);
    const [optimisticTickets, setOptimisticTickets] = useState<Ticket[]>(tickets);

    React.useEffect(() => {
        setOptimisticTickets(tickets);
    }, [tickets]);

    const columns: Column[] = [
        {
            id: 'open',
            title: 'Open',
            icon: AlertCircle,
            color: 'text-red-600',
            bgColor: 'bg-red-50',
            borderColor: 'border-red-200',
            iconColor: 'text-red-500',
            status: 'Open'
        },
        {
            id: 'in_progress',
            title: 'In Progress',
            icon: Clock,
            color: 'text-blue-600',
            bgColor: 'bg-blue-50',
            borderColor: 'border-blue-200',
            iconColor: 'text-blue-500',
            status: 'In Progress'
        },
        {
            id: 'resolved',
            title: 'Resolved',
            icon: CheckCircle,
            color: 'text-green-600',
            bgColor: 'bg-green-50',
            borderColor: 'border-green-200',
            iconColor: 'text-green-500',
            status: 'Resolved'
        },
        {
            id: 'closed',
            title: 'Closed',
            icon: XCircle,
            color: 'text-gray-600',
            bgColor: 'bg-gray-50',
            borderColor: 'border-gray-200',
            iconColor: 'text-gray-500',
            status: 'Closed'
        },
    ];

    const priorityColors: Record<string, string> = {
        Low: 'bg-gray-100 text-gray-700',
        Medium: 'bg-blue-100 text-blue-700',
        High: 'bg-orange-100 text-orange-700',
        Urgent: 'bg-red-100 text-red-700'
    };

    const getTicketsByStatus = (status: string) => {
        return optimisticTickets.filter((ticket) => ticket.status === status);
    };

    const handleDragStart = (e: React.DragEvent, ticket: Ticket) => {
        setDraggedTicket(ticket);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    async function handleDrop(e: React.DragEvent, targetStatus: string) {
        e.preventDefault();

        if (!draggedTicket || draggedTicket.status === targetStatus) {
            setDraggedTicket(null);
            return;
        }

        // Optimistic update
        const updatedTicket = { ...draggedTicket, status: targetStatus };
        setOptimisticTickets((prev) =>
            prev.map((ticket) =>
                ticket.id === draggedTicket.id ? updatedTicket : ticket
            )
        );
        setDraggedTicket(null);
        setUpdating(true);

        try {
            onStatusChange(draggedTicket, targetStatus);
        } catch (error) {
            console.error('Failed to update ticket status:', error);
            setOptimisticTickets(tickets);
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
                    <p className="text-sm text-gray-500">Loading tickets...</p>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {columns.map((column) => {
                    const columnTickets = getTicketsByStatus(column.status);
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
                                    <h3 className="font-semibold text-gray-700 text-sm">{column.title}</h3>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${column.color} bg-white`}>
                                        {columnTickets.length}
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
                                {columnTickets.map((ticket) => (
                                    <div
                                        key={ticket.id}
                                        draggable={!updating}
                                        onDragStart={(e) => handleDragStart(e, ticket)}
                                        onClick={() => onTicketClick(ticket)}
                                        className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-all cursor-grab active:cursor-grabbing hover:border-blue-300"
                                    >
                                        <div className="p-3">
                                            {/* Drag Handle & Actions */}
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2 text-gray-400">
                                                    <GripVertical size={14} />
                                                    <span className="text-xs font-mono truncate max-w-[80px] text-gray-500">
                                                        #{ticket.id.slice(0, 8)}
                                                    </span>
                                                </div>
                                                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                                    <button
                                                        onClick={() => onTicketEdit(ticket)}
                                                        className="p-1 text-gray-400 hover:text-amber-600 transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Edit size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => onTicketDelete(ticket)}
                                                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Ticket Subject */}
                                            <h4 className="font-semibold text-gray-900 text-sm mb-2 line-clamp-2">
                                                {ticket.subject}
                                            </h4>

                                            {/* Description */}
                                            {ticket.description && (
                                                <p className="text-xs text-gray-500 line-clamp-2 mb-2">
                                                    {ticket.description}
                                                </p>
                                            )}

                                            {/* Priority */}
                                            <div className="flex items-center justify-between mb-2">
                                                <span className={`px-2 py-0.5 text-xs font-medium rounded ${priorityColors[ticket.priority] || 'bg-gray-100 text-gray-700'}`}>
                                                    {ticket.priority}
                                                </span>
                                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                                    <Clock size={12} />
                                                    {formatDate(ticket.created_at)}
                                                </div>
                                            </div>

                                            {/* Assigned User */}
                                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                                                <div className="flex items-center gap-2">
                                                    {ticket.assigned_user?.avatar ? (
                                                        <img
                                                            src={ticket.assigned_user.avatar}
                                                            alt=""
                                                            className="w-5 h-5 rounded-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-medium">
                                                            {ticket.assigned_user?.full_name?.[0] || '?'}
                                                        </div>
                                                    )}
                                                    <span className="text-xs text-gray-500 truncate max-w-[80px]">
                                                        {ticket.assigned_user?.full_name?.split(' ')[0] || 'Unassigned'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {/* Empty State */}
                                {columnTickets.length === 0 && (
                                    <div className="bg-gray-50 rounded-lg border border-dashed border-gray-300 p-6 text-center">
                                        <ColumnIcon size={24} className={`mx-auto mb-2 ${column.iconColor} opacity-50`} />
                                        <p className="text-xs text-gray-400">No tickets</p>
                                        <p className="text-xs text-gray-400">Drop here to move</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default TicketsKanban;
