"use client";

import { useState, useEffect } from "react";
import {
    X,
    Calculator,
    DollarSign,
    Percent,
    Loader2,
    AlertCircle,
    RefreshCw,
    Download,
    Info,
} from "lucide-react";
import { useOverlayDismiss } from "@/src/hooks/useOverlayDismiss";

interface FinanceCalculation {
    id?: string;
    vehicle_id?: string;
    customer_id?: string;
    sale_price: number;
    down_payment: number;
    trade_in_value: number;
    interest_rate: number;
    term_months: number;
    payment_type: "monthly" | "biweekly" | "weekly";
    payment_amount: number;
    total_interest: number;
    total_cost: number;
    tax_amount: number;
    admin_fee: number;
}

interface FinanceCalculatorModalProps {
    vehicleId?: string;
    vehiclePrice?: number;
    customerId?: string;
    onClose: () => void;
    onSave?: (calculation: FinanceCalculation) => void;
}

export default function FinanceCalculatorModal({
    vehicleId,
    vehiclePrice = 0,
    customerId,
    onClose,
    onSave
}: FinanceCalculatorModalProps) {
    useOverlayDismiss(onClose);

    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState({
        sale_price: vehiclePrice || 30000,
        down_payment: 0,
        trade_in_value: 0,
        interest_rate: 5.99,
        term_months: 60,
        tax_rate: 13, // Ontario HST
        admin_fee: 899,
        payment_type: "monthly" as "monthly" | "biweekly" | "weekly"
    });

    const [result, setResult] = useState<{
        payment_amount: number;
        total_interest: number;
        total_cost: number;
        tax_amount: number;
        financed_amount: number;
    } | null>(null);

    const calculatePayment = () => {
        const {
            sale_price,
            down_payment,
            trade_in_value,
            interest_rate,
            term_months,
            tax_rate,
            admin_fee,
            payment_type
        } = formData;

        // Calculate tax
        const taxAmount = sale_price * (tax_rate / 100);

        // Total vehicle cost with taxes and fees
        const totalCost = sale_price + taxAmount + admin_fee - trade_in_value - down_payment;

        // Financed amount
        const financedAmount = totalCost > 0 ? totalCost : 0;

        // Interest rate per period
        const periodicRate = interest_rate / 100 / (payment_type === "monthly" ? 12 : payment_type === "biweekly" ? 26 : 52);

        // Number of payment periods
        const numPeriods = payment_type === "monthly" ? term_months : payment_type === "biweekly" ? term_months * 26 / 12 : term_months * 52 / 12;

        // Monthly payment calculation using loan formula
        // M = P * [r(1+r)^n] / [(1+r)^n - 1]
        let paymentAmount = 0;
        let totalInterest = 0;
        const n = numPeriods;

        if (interest_rate > 0 && financedAmount > 0) {
            const r = periodicRate;
            const factor = Math.pow(1 + r, n);
            paymentAmount = financedAmount * (r * factor) / (factor - 1);
            totalInterest = paymentAmount * n - financedAmount;
        } else if (financedAmount > 0) {
            paymentAmount = financedAmount / n;
            totalInterest = 0;
        }

        setResult({
            payment_amount: paymentAmount,
            total_interest: totalInterest,
            total_cost: financedAmount + totalInterest,
            tax_amount: taxAmount,
            financed_amount: financedAmount
        });
    };

    useEffect(() => {
        calculatePayment();
    }, [formData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: name === "payment_type" ? value : parseFloat(value) || 0
        }));
    };

    async function handleSave() {
        if (!result) return;

        setSaving(true);
        setError(null);

        try {
            const calculation: FinanceCalculation = {
                vehicle_id: vehicleId,
                customer_id: customerId,
                sale_price: formData.sale_price,
                down_payment: formData.down_payment,
                trade_in_value: formData.trade_in_value,
                interest_rate: formData.interest_rate,
                term_months: formData.term_months,
                payment_type: formData.payment_type,
                payment_amount: result.payment_amount,
                total_interest: result.total_interest,
                total_cost: result.total_cost,
                tax_amount: result.tax_amount,
                admin_fee: formData.admin_fee
            };

            if (onSave) {
                onSave(calculation);
            }

            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save calculation");
        } finally {
            setSaving(false);
        }
    }

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("en-CA", {
            style: "currency",
            currency: "CAD"
        }).format(value);
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>

            <div className="relative min-h-screen flex items-center justify-center p-4">
                <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                    {/* Header */}
                    <div className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 border-b border-gray-100 px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl">
                                <Calculator className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Finance Calculator</h2>
                                <p className="text-xs text-gray-500">
                                    Calculate monthly or bi-weekly payments
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>

                    <div className="p-6">
                        {/* Error Alert */}
                        {error && (
                            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-600">{error}</p>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Left Column - Inputs */}
                            <div className="space-y-5">
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                                    Vehicle & Pricing
                                </h3>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Vehicle Price
                                    </label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="number"
                                            name="sale_price"
                                            value={formData.sale_price}
                                            onChange={handleChange}
                                            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                                            min={0}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                            Down Payment
                                        </label>
                                        <div className="relative">
                                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                type="number"
                                                name="down_payment"
                                                value={formData.down_payment}
                                                onChange={handleChange}
                                                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                                                min={0}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                            Trade-In Value
                                        </label>
                                        <div className="relative">
                                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                type="number"
                                                name="trade_in_value"
                                                value={formData.trade_in_value}
                                                onChange={handleChange}
                                                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                                                min={0}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Tax Rate (%)
                                    </label>
                                    <div className="relative">
                                        <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="number"
                                            name="tax_rate"
                                            value={formData.tax_rate}
                                            onChange={handleChange}
                                            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                                            min={0}
                                            max={30}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Admin Fee
                                    </label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="number"
                                            name="admin_fee"
                                            value={formData.admin_fee}
                                            onChange={handleChange}
                                            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                                            min={0}
                                        />
                                    </div>
                                </div>

                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider pt-4">
                                    Financing Terms
                                </h3>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Interest Rate (%)
                                    </label>
                                    <div className="relative">
                                        <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="number"
                                            name="interest_rate"
                                            value={formData.interest_rate}
                                            onChange={handleChange}
                                            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                                            min={0}
                                            max={30}
                                            step={0.1}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Term (Months)
                                    </label>
                                    <select
                                        name="term_months"
                                        value={formData.term_months}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                                    >
                                        <option value={12}>12 Months</option>
                                        <option value={24}>24 Months</option>
                                        <option value={36}>36 Months</option>
                                        <option value={48}>48 Months</option>
                                        <option value={60}>60 Months</option>
                                        <option value={72}>72 Months</option>
                                        <option value={84}>84 Months</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Payment Frequency
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {(["monthly", "biweekly", "weekly"] as const).map((type) => (
                                            <button
                                                key={type}
                                                onClick={() => setFormData((prev) => ({ ...prev, payment_type: type }))}
                                                className={`px-4 py-2.5 rounded-lg border-2 transition-all capitalize ${
                                                    formData.payment_type === type
                                                        ? "border-amber-500 bg-amber-50 text-amber-700"
                                                        : "border-gray-200 hover:border-amber-300"
                                                }`}
                                            >
                                                {type === "biweekly" ? "Bi-Weekly" : type}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Right Column - Results */}
                            <div className="space-y-5">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                                        Calculation Results
                                    </h3>
                                    <button
                                        onClick={() => {
                                            setFormData((prev) => ({
                                                ...prev,
                                                down_payment: 0,
                                                trade_in_value: 0
                                            }));
                                        }}
                                        className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1"
                                    >
                                        <RefreshCw className="w-3 h-3" />
                                        Reset
                                    </button>
                                </div>

                                {result && (
                                    <>
                                        {/* Main Payment Result */}
                                        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-6 text-white">
                                            <p className="text-sm opacity-80 mb-1">Your {formData.payment_type} payment</p>
                                            <p className="text-4xl font-bold mb-1">
                                                {formatCurrency(result.payment_amount)}
                                            </p>
                                            <p className="text-sm opacity-80">
                                                {formData.payment_type === "monthly" ? "/month" : formData.payment_type === "biweekly" ? "/bi-week" : "/week"}
                                            </p>
                                        </div>

                                        {/* Breakdown */}
                                        <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                                            <h4 className="text-sm font-medium text-gray-700">Payment Breakdown</h4>

                                            <div className="space-y-2">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-500">Vehicle Price</span>
                                                    <span className="font-medium">{formatCurrency(formData.sale_price)}</span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-500">Tax ({formData.tax_rate}%)</span>
                                                    <span className="font-medium">{formatCurrency(result.tax_amount)}</span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-500">Admin Fee</span>
                                                    <span className="font-medium">{formatCurrency(formData.admin_fee)}</span>
                                                </div>
                                                {formData.down_payment > 0 && (
                                                    <div className="flex justify-between text-sm text-emerald-600">
                                                        <span>Down Payment</span>
                                                        <span>-{formatCurrency(formData.down_payment)}</span>
                                                    </div>
                                                )}
                                                {formData.trade_in_value > 0 && (
                                                    <div className="flex justify-between text-sm text-emerald-600">
                                                        <span>Trade-In Value</span>
                                                        <span>-{formatCurrency(formData.trade_in_value)}</span>
                                                    </div>
                                                )}
                                                <div className="border-t pt-2 mt-2">
                                                    <div className="flex justify-between text-sm font-semibold">
                                                        <span>Financed Amount</span>
                                                        <span>{formatCurrency(result.financed_amount)}</span>
                                                    </div>
                                                </div>
                                                <div className="flex justify-between text-sm text-amber-600">
                                                    <span>Total Interest</span>
                                                    <span>{formatCurrency(result.total_interest)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                                            <div className="flex items-start gap-3">
                                                <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                                <div className="text-sm">
                                                    <p className="font-medium text-amber-800">Total Cost of Financing</p>
                                                    <p className="text-amber-700 mt-1">
                                                        {formatCurrency(result.total_cost)} over {formData.term_months} months
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Comparison */}
                                        <div className="bg-gray-50 rounded-xl p-4">
                                            <h4 className="text-sm font-medium text-gray-700 mb-3">Payment Comparison</h4>
                                            <div className="grid grid-cols-3 gap-3 text-center">
                                                <div className="bg-white p-3 rounded-lg border">
                                                    <p className="text-lg font-bold text-gray-900">
                                                        {formatCurrency(result.payment_amount * 2)}
                                                    </p>
                                                    <p className="text-xs text-gray-500">Bi-Weekly</p>
                                                </div>
                                                <div className="bg-white p-3 rounded-lg border">
                                                    <p className="text-lg font-bold text-gray-900">
                                                        {formatCurrency(result.payment_amount * 4)}
                                                    </p>
                                                    <p className="text-xs text-gray-500">Weekly</p>
                                                </div>
                                                <div className="bg-white p-3 rounded-lg border">
                                                    <p className="text-lg font-bold text-gray-900">
                                                        {formatCurrency(result.payment_amount * 12)}
                                                    </p>
                                                    <p className="text-xs text-gray-500">Yearly</p>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 mt-8 pt-6 border-t border-gray-200">
                            <button
                                onClick={onClose}
                                className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving || !result}
                                className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl hover:shadow-lg hover:shadow-amber-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Download className="w-4 h-4" />
                                        Save Calculation
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
