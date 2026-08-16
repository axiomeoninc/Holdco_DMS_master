"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Head from "next/head";
import {
    Scan,
    Calculator,
    Search,
    ArrowRight,
    Plus,
} from "lucide-react";
import OCRScannerModal from "@/src/components/OCRScannerModal";
import VINLookupModal from "@/src/components/VINLookupModal";
import FinanceCalculatorModal from "@/src/components/FinanceCalculatorModal";
import { PENDING_VIN_SPECS_KEY } from "@/src/lib/pending-vin-specs";

interface VehicleSpec {
    vin: string;
    year?: number;
    make?: string;
    model?: string;
    trim?: string;
    engine?: string;
    body_style?: string;
    fuel_type?: string;
    transmission?: string;
    drivetrain?: string;
    exterior_color?: string;
    interior_color?: string;
}

interface Tool {
    id: string;
    name: string;
    description: string;
    icon: React.ElementType;
    gradient: string;
    onClick: () => void;
}

export default function ToolsPage() {
    const router = useRouter();
    const [activeModal, setActiveModal] = useState<string | null>(null);
    const [pendingVinSpecs, setPendingVinSpecs] = useState<VehicleSpec | null>(null);

    const goToIntake = (specs?: VehicleSpec | null) => {
        if (specs) {
            try {
                sessionStorage.setItem(PENDING_VIN_SPECS_KEY, JSON.stringify(specs));
            } catch {
                // ignore
            }
        }
        router.push("/inventory/add");
    };

    const tools: Tool[] = [
        {
            id: "ocr",
            name: "OCR Scanner",
            description: "Scan driver's license or ID to auto-fill customer information",
            icon: Scan,
            gradient: "from-emerald-500 to-teal-600",
            onClick: () => setActiveModal("ocr"),
        },
        {
            id: "vin",
            name: "VIN Lookup",
            description: "Enter VIN to auto-populate vehicle specs and get Carfax report",
            icon: Search,
            gradient: "from-violet-500 to-purple-600",
            onClick: () => setActiveModal("vin"),
        },
        {
            id: "finance",
            name: "Finance Calculator",
            description: "Calculate monthly or bi-weekly payments with tax and fees",
            icon: Calculator,
            gradient: "from-amber-500 to-orange-600",
            onClick: () => setActiveModal("finance"),
        },
    ];

    return (
        <>
            <Head>
                <title>Tools | DMS</title>
            </Head>

            <div className="p-6">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-foreground">Dealership Tools</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Access automation tools to streamline your workflow
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {tools.map((tool) => {
                        const Icon = tool.icon;
                        return (
                            <button
                                key={tool.id}
                                onClick={tool.onClick}
                                className="group relative rounded-2xl border border-border bg-card p-6 text-left transition-all duration-300 hover:border-transparent hover:shadow-xl"
                            >
                                <div
                                    className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${tool.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
                                />
                                <div className="relative z-10">
                                    <div
                                        className={`mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${tool.gradient} transition-colors group-hover:bg-white/20`}
                                    >
                                        <Icon className="h-7 w-7 text-white" />
                                    </div>
                                    <h3 className="mb-2 text-lg font-semibold text-foreground transition-colors group-hover:text-white">
                                        {tool.name}
                                    </h3>
                                    <p className="text-sm text-muted-foreground transition-colors group-hover:text-white/80">
                                        {tool.description}
                                    </p>
                                    <div className="mt-4 flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors group-hover:text-white">
                                        <span>Open tool</span>
                                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {pendingVinSpecs && (
                    <div className="mt-8 rounded-2xl bg-gradient-to-r from-primary to-primary-600 p-6 shadow-xl">
                        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                            <div className="text-primary-foreground">
                                <h3 className="mb-1 text-lg font-semibold">
                                    {pendingVinSpecs.year} {pendingVinSpecs.make} {pendingVinSpecs.model}
                                </h3>
                                <p className="text-sm text-primary-foreground/80">
                                    VIN: {pendingVinSpecs.vin}
                                    {pendingVinSpecs.trim && ` • ${pendingVinSpecs.trim}`}
                                    {pendingVinSpecs.engine && ` • ${pendingVinSpecs.engine}`}
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setPendingVinSpecs(null);
                                        setActiveModal("vin");
                                    }}
                                    className="flex items-center gap-2 rounded-lg bg-white/20 px-4 py-2 text-primary-foreground transition-colors hover:bg-white/30"
                                >
                                    <Search className="h-4 w-4" />
                                    Search Another
                                </button>
                                <button
                                    onClick={() => goToIntake(pendingVinSpecs)}
                                    className="flex items-center gap-2 rounded-lg bg-card px-4 py-2 font-medium text-primary transition-colors hover:bg-muted"
                                >
                                    <Plus className="h-4 w-4" />
                                    Add to Inventory
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {activeModal === "ocr" && (
                <OCRScannerModal
                    onClose={() => setActiveModal(null)}
                    onScanComplete={(data) => console.log("OCR Data:", data)}
                    onCustomerCreated={(data) => console.log("Create customer with:", data)}
                />
            )}

            {activeModal === "vin" && (
                <VINLookupModal
                    onClose={() => setActiveModal(null)}
                    onVinFound={(specs) => {
                        setPendingVinSpecs(specs);
                        goToIntake(specs);
                    }}
                    onCarfaxRetrieved={(report) => console.log("Carfax Report:", report)}
                />
            )}

            {activeModal === "finance" && (
                <FinanceCalculatorModal
                    onClose={() => setActiveModal(null)}
                    onSave={(calculation) => console.log("Saved calculation:", calculation)}
                />
            )}
        </>
    );
}
