"use client";

import { useEffect } from "react";
import {
    X,
    AlertTriangle,
    Trash2,
    Loader2,
} from "lucide-react";
import { useOverlayDismiss } from "@/src/hooks/useOverlayDismiss";

interface ConfirmDialogProps {
    isOpen: boolean;
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "danger" | "warning" | "info";
    onConfirm: () => void;
    onCancel: () => void;
    loading?: boolean;
}

export default function ConfirmDialog({
    isOpen,
    title = "Confirm Action",
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    variant = "danger",
    onConfirm,
    onCancel,
    loading = false
}: ConfirmDialogProps) {
    useOverlayDismiss(onCancel, { open: isOpen });

    // Reset loading when dialog closes
    useEffect(() => {
        if (!isOpen) {
            // Loading will auto-reset since parent controls it
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const variantStyles = {
        danger: {
            icon: <Trash2 className="w-6 h-6 text-red-600" />,
            bgIcon: "bg-red-100",
            bgButton: "bg-red-600 hover:bg-red-700",
            textButton: "text-white"
        },
        warning: {
            icon: <AlertTriangle className="w-6 h-6 text-amber-600" />,
            bgIcon: "bg-amber-100",
            bgButton: "bg-amber-600 hover:bg-amber-700",
            textButton: "text-white"
        },
        info: {
            icon: <AlertTriangle className="w-6 h-6 text-blue-600" />,
            bgIcon: "bg-blue-100",
            bgButton: "bg-blue-600 hover:bg-blue-700",
            textButton: "text-white"
        }
    };

    const styles = variantStyles[variant];

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onCancel();
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={handleBackdropClick}
            />

            {/* Dialog */}
            <div className="relative min-h-screen flex items-center justify-center p-4">
                <div
                    className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full transform transition-all"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Close Button */}
                    <button
                        onClick={onCancel}
                        className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        disabled={loading}
                    >
                        <X className="w-5 h-5 text-gray-400" />
                    </button>

                    <div className="p-6">
                        {/* Icon */}
                        <div className="flex justify-center mb-4">
                            <div className={`p-4 rounded-full ${styles.bgIcon}`}>
                                {styles.icon}
                            </div>
                        </div>

                        {/* Title */}
                        <h2 className="text-xl font-bold text-gray-900 text-center mb-2">
                            {title}
                        </h2>

                        {/* Message */}
                        <p className="text-gray-600 text-center mb-6">
                            {message}
                        </p>

                        {/* Actions */}
                        <div className="flex gap-3">
                            <button
                                onClick={onCancel}
                                disabled={loading}
                                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                            >
                                {cancelText}
                            </button>
                            <button
                                onClick={onConfirm}
                                disabled={loading}
                                className={`flex-1 px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2 ${styles.bgButton} ${styles.textButton}`}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    confirmText
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
