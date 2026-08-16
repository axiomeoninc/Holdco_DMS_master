"use client";

import { Clock } from "lucide-react";

export default function ComingSoon() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
            {/* Logo */}
            <div className="mb-6">
                <img
                    src="/logo.svg"
                    alt="DMS Logo"
                    className="w-92 h-20 mx-auto"
                />
            </div>

            {/* Icon */}
            {/* <div className="bg-blue-50 rounded-full p-6 mb-4">
                <Construction className="w-16 h-16 text-blue-600" />
            </div> */}

            {/* Title */}
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Coming Soon</h2>

            {/* Description */}
            <p className="text-gray-500 max-w-md mb-6">
                This feature is currently under development. We&apos;re working hard to bring it to you soon!
            </p>

            {/* Status Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full">
                <Clock className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-700">In Development</span>
            </div>

            {/* Decorative Line */}
            <div className="mt-6 w-16 h-1 bg-gradient-to-r from-blue-400 to-indigo-600 rounded-full"></div>
        </div>
    );
}