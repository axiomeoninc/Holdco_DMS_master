"use client";

import { useState, useRef } from "react";
import {
    X,
    Camera,
    Upload,
    Scan,
    Loader2,
    AlertCircle,
    CheckCircle,
    User,
    Shield,
    CreditCard,
} from "lucide-react";
import { useOverlayDismiss } from "@/src/hooks/useOverlayDismiss";

interface OCRDocument {
    id: string;
    customer_id?: string;
    document_type: string;
    document_number?: string;
    first_name?: string;
    last_name?: string;
    date_of_birth?: string;
    expiry_date?: string;
    address?: string;
    city?: string;
    province?: string;
    postal_code?: string;
    confidence_score?: number;
    image_url?: string;
    is_verified?: boolean;
}

interface OCRScannerModalProps {
    customerId?: string;
    onClose: () => void;
    onScanComplete: (data: Partial<OCRDocument>) => void;
    onCustomerCreated?: (data: Partial<OCRDocument>) => void;
}

export default function OCRScannerModal({
    customerId: _customerId,
    onClose,
    onScanComplete,
    onCustomerCreated
}: OCRScannerModalProps) {
    useOverlayDismiss(onClose);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [documentType, setDocumentType] = useState<"drivers_license" | "government_id">("drivers_license");
    const [scannedData, setScannedData] = useState<Partial<OCRDocument> | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [uploadMethod, setUploadMethod] = useState<"upload" | "camera">("upload");
    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [cameraActive, setCameraActive] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    async function startCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" },
                audio: false
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.style.display = 'block';
                videoRef.current.style.width = '100%';
                videoRef.current.style.height = '320px';
                videoRef.current.style.objectFit = 'cover';
                videoRef.current.style.backgroundColor = 'black';
                await videoRef.current.play();
                setCameraActive(true);
            }
        } catch {
            setError("Unable to access camera. Please use upload method instead.");
        }
    }

    const stopCamera = () => {
        if (videoRef.current?.srcObject) {
            const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
            tracks.forEach(track => track.stop());
            setCameraActive(false);
        }
    };

    const capturePhoto = () => {
        if (videoRef.current) {
            const canvas = document.createElement("canvas");
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const ctx = canvas.getContext("2d");
            ctx?.drawImage(videoRef.current, 0, 0);
            const imageData = canvas.toDataURL("image/jpeg");
            setImagePreview(imageData);
            stopCamera();

            // Convert data URL to file for processing
            fetch(imageData)
                .then(res => res.blob())
                .then(blob => {
                    const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
                    processImage(file);
                });
        }
    };

    async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        // Create preview
        const reader = new FileReader();
        reader.onload = (e) => {
            setImagePreview(e.target?.result as string);
        };
        reader.readAsDataURL(file);

        // Process with OCR
        await processImage(file);
    }

    async function processImage(file: File) {
        setIsProcessing(true);
        setLoading(true);
        setError(null);

        try {
            // Use Tesseract.js for real OCR
            const Tesseract = (await import("tesseract.js")).default;
            const result = await Tesseract.recognize(file, 'eng', {
                logger: (m) => console.log(m)
            });

            const text = result.data.text;
            const confidence = result.data.confidence;

            // Parse the OCR text to extract relevant information
            const parsedData = parseOCRText(text, documentType);
            parsedData.confidence_score = confidence;
            parsedData.document_type = documentType;
            parsedData.image_url = imagePreview || undefined;

            console.log("OCR Raw text:", text);
            console.log("OCR Parsed data:", parsedData);
            setScannedData(parsedData);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to process image");
        } finally {
            setLoading(false);
            setIsProcessing(false);
        }
    }

    const parseOCRText = (text: string, type: string): Partial<OCRDocument> => {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        const data: Partial<OCRDocument> = {
            document_type: type
        };

        // Common patterns for ID extraction
        const patterns = {
            firstName: /(?:first\s*name|given\s*name|first\s*given)[:\s]*([A-Za-z]+)/i,
            lastName: /(?:last\s*name|surname|family\s*name)[:\s]*([A-Za-z]+)/i,
            fullName: /(?:name|full\s*name)[:\s]*([A-Za-z]+\s+[A-Za-z]+)/i,
            dob: /(?:dob|date\s*of\s*birth|birth\s*date)[:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
            expiry: /(?:expiry|expiration|valid\s*until|expires?)[:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
            documentNumber: /(?:document\s*number|dl|license\s*number|id\s*number|licence\s*#)[:\s]*([A-Z0-9]+)/i,
            address: /(?:address|street|addr)[:\s]*([A-Za-z0-9\s,]+)/i,
            city: /(?:city|town)[:\s]*([A-Za-z\s]+)/i,
            province: /(?:province|prov|state)[:\s]*([A-Za-z]{2})/i,
            postalCode: /(?:postal\s*code|zip|zip\s*code|postcode)[:\s]*([A-Z0-9\s]+)/i
        };

        // Extract first name
        for (const line of lines) {
            const firstMatch = line.match(patterns.firstName);
            if (firstMatch) data.first_name = firstMatch[1];
            const lastMatch = line.match(patterns.lastName);
            if (lastMatch) data.last_name = lastMatch[1];
            const dobMatch = line.match(patterns.dob);
            if (dobMatch) data.date_of_birth = normalizeDate(dobMatch[1]);
            const expiryMatch = line.match(patterns.expiry);
            if (expiryMatch) data.expiry_date = normalizeDate(expiryMatch[1]);
            const docMatch = line.match(patterns.documentNumber);
            if (docMatch) data.document_number = docMatch[1];
        }

        // Try to extract name from full line if separate fields not found
        if (!data.first_name || !data.last_name) {
            const fullMatch = text.match(patterns.fullName);
            if (fullMatch) {
                const parts = fullMatch[1].split(' ');
                if (!data.first_name && parts[0]) data.first_name = parts[0];
                if (!data.last_name && parts.length > 1) data.last_name = parts[parts.length - 1];
            }
        }

        // Look for address-like patterns
        for (const line of lines) {
            if (line.match(/\d+\s+[A-Za-z]+\s+(st|street|ave|avenue|rd|road|dr|drive)/i)) {
                data.address = line;
            }
            if (line.match(/^[A-Za-z]+(?:\s+[A-Za-z]+)*$/i) && !data.city && line.length < 30) {
                data.city = line;
            }
        }

        // Look for province (2 letter codes like ON, BC, etc.)
        const provinceMatch = text.match(/\b(ON|BC|AB|SK|MB|QC|NS|NB|NL|PE|NT|NU|YT)\b/i);
        if (provinceMatch) data.province = provinceMatch[1].toUpperCase();

        // Look for postal code pattern
        const postalMatch = text.match(/\b([A-Z]\d[A-Z]\s?\d[A-Z]\d)\b/i);
        if (postalMatch) data.postal_code = postalMatch[1].toUpperCase();

        return data;
    };

    const normalizeDate = (dateStr: string): string => {
        // Try to normalize date to YYYY-MM-DD format
        const parts = dateStr.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/);
        if (parts) {
            let year = parseInt(parts[3]);
            if (year < 100) year += 2000;
            return `${year}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        }
        return dateStr;
    };

    const handleUseData = () => {
        if (scannedData) {
            console.log("handleUseData, sending scannedData:", scannedData);
            onScanComplete(scannedData);
            if (onCustomerCreated && scannedData.first_name && scannedData.last_name) {
                onCustomerCreated(scannedData);
            }
        }
    };

    const handleRescan = () => {
        setScannedData(null);
        setImagePreview(null);
        setError(null);
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>

            <div className="relative min-h-screen flex items-center justify-center p-4">
                <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                    {/* Header */}
                    <div className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 border-b border-gray-100 px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl">
                                <Scan className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">OCR Document Scanner</h2>
                                <p className="text-xs text-gray-500">
                                    Scan ID to auto-fill customer information
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

                        {!scannedData ? (
                            <>
                                {/* Document Type Selection */}
                                <div className="mb-6">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Document Type
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => setDocumentType("drivers_license")}
                                            className={`p-4 rounded-xl border-2 transition-all ${
                                                documentType === "drivers_license"
                                                    ? "border-emerald-500 bg-emerald-50"
                                                    : "border-gray-200 hover:border-emerald-300"
                                            }`}
                                        >
                                            <CreditCard className={`w-8 h-8 mx-auto mb-2 ${
                                                documentType === "drivers_license" ? "text-emerald-600" : "text-gray-400"
                                            }`} />
                                            <p className={`text-sm font-medium ${
                                                documentType === "drivers_license" ? "text-emerald-700" : "text-gray-600"
                                            }`}>Driver&apos;s License</p>
                                        </button>
                                        <button
                                            onClick={() => setDocumentType("government_id")}
                                            className={`p-4 rounded-xl border-2 transition-all ${
                                                documentType === "government_id"
                                                    ? "border-emerald-500 bg-emerald-50"
                                                    : "border-gray-200 hover:border-emerald-300"
                                            }`}
                                        >
                                            <Shield className={`w-8 h-8 mx-auto mb-2 ${
                                                documentType === "government_id" ? "text-emerald-600" : "text-gray-400"
                                            }`} />
                                            <p className={`text-sm font-medium ${
                                                documentType === "government_id" ? "text-emerald-700" : "text-gray-600"
                                            }`}>Government ID</p>
                                        </button>
                                    </div>
                                </div>

                                {/* Upload Method Selection */}
                                <div className="mb-6">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Upload Method
                                    </label>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setUploadMethod("upload")}
                                            className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                                                uploadMethod === "upload"
                                                    ? "border-blue-500 bg-blue-50 text-blue-700"
                                                    : "border-gray-200 hover:border-blue-300"
                                            }`}
                                        >
                                            <Upload className="w-4 h-4" />
                                            <span className="text-sm font-medium">Upload Image</span>
                                        </button>
                                        <button
                                            onClick={() => {
                                                setUploadMethod("camera");
                                                startCamera();
                                            }}
                                            className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                                                uploadMethod === "camera"
                                                    ? "border-blue-500 bg-blue-50 text-blue-700"
                                                    : "border-gray-200 hover:border-blue-300"
                                            }`}
                                        >
                                            <Camera className="w-4 h-4" />
                                            <span className="text-sm font-medium">Use Camera</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Upload Area / Camera */}
                                {uploadMethod === "upload" ? (
                                    <div
                                        className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-emerald-400 transition-colors cursor-pointer"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            onChange={handleFileSelect}
                                            className="hidden"
                                        />
                                        {loading || isProcessing ? (
                                            <div className="flex flex-col items-center">
                                                <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-3" />
                                                <p className="text-sm text-gray-600">Processing document...</p>
                                                <p className="text-xs text-gray-400 mt-1">
                                                    Extracting information from image
                                                </p>
                                            </div>
                                        ) : (
                                            <>
                                                <Scan className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                                <p className="text-sm text-gray-600">
                                                    Click to upload or drag and drop
                                                </p>
                                                <p className="text-xs text-gray-400 mt-1">
                                                    JPG, PNG, or PDF (max 10MB)
                                                </p>
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    <div className="relative border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-gray-900" style={{ minHeight: '320px' }}>
                                        {/* Video element - always present but hidden until camera starts */}
                                        <video
                                            ref={videoRef}
                                            autoPlay
                                            playsInline
                                            muted
                                            className={`${cameraActive ? 'block' : 'hidden'} w-full h-80 object-cover bg-black`}
                                        />
                                        {/* Overlay when camera not active */}
                                        {!cameraActive && (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                <Camera className="w-12 h-12 text-gray-400 mb-3" />
                                                <p className="text-sm text-gray-300 mb-3">
                                                    Click to start camera
                                                </p>
                                                <button
                                                    onClick={startCamera}
                                                    className="px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors font-medium"
                                                >
                                                    Start Camera
                                                </button>
                                            </div>
                                        )}
                                        {/* Buttons when camera is active */}
                                        {cameraActive && (
                                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3">
                                                <button
                                                    onClick={stopCamera}
                                                    className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={capturePhoto}
                                                    className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2 font-medium"
                                                >
                                                    <Camera className="w-5 h-5" />
                                                    Take Photo
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Image Preview */}
                                {imagePreview && !scannedData && (
                                    <div className="mt-6">
                                        <p className="text-sm font-medium text-gray-700 mb-2">Preview</p>
                                        <img
                                            src={imagePreview}
                                            alt="Preview"
                                            className="w-full h-48 object-contain rounded-xl border border-gray-200"
                                        />
                                    </div>
                                )}
                            </>
                        ) : (
                            /* Scanned Data Display */
                            <div className="space-y-6">
                                <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl">
                                    <CheckCircle className="w-6 h-6 text-emerald-600" />
                                    <div>
                                        <p className="text-sm font-medium text-emerald-700">
                                            Document Scanned Successfully
                                        </p>
                                        <p className="text-xs text-emerald-600">
                                            Confidence: {scannedData.confidence_score?.toFixed(1)}%
                                        </p>
                                    </div>
                                </div>

                                {/* Customer Info */}
                                <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                                    <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                        <User className="w-4 h-4" />
                                        Extracted Information
                                    </h3>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-gray-500">First Name</label>
                                            <p className="text-sm font-medium text-gray-900">{scannedData.first_name}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500">Last Name</label>
                                            <p className="text-sm font-medium text-gray-900">{scannedData.last_name}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500">Document Number</label>
                                            <p className="text-sm font-medium text-gray-900">{scannedData.document_number}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500">Date of Birth</label>
                                            <p className="text-sm font-medium text-gray-900">{scannedData.date_of_birth}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500">Expiry Date</label>
                                            <p className="text-sm font-medium text-gray-900">{scannedData.expiry_date}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500">Address</label>
                                            <p className="text-sm font-medium text-gray-900">{scannedData.address}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500">City</label>
                                           <p className="text-sm font-medium text-gray-900">{scannedData.city}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500">Province</label>
                                            <p className="text-sm font-medium text-gray-900">{scannedData.province}</p>
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-xs text-gray-500">Postal Code</label>
                                            <p className="text-sm font-medium text-gray-900">{scannedData.postal_code}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Document Image */}
                                {imagePreview && (
                                    <div>
                                        <p className="text-sm font-medium text-gray-700 mb-2">Scanned Document</p>
                                        <img
                                            src={imagePreview}
                                            alt="Scanned document"
                                            className="w-full h-48 object-contain rounded-xl border border-gray-200"
                                        />
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-3">
                                    <button
                                        onClick={handleRescan}
                                        className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                                    >
                                        Rescan
                                    </button>
                                    <button
                                        onClick={handleUseData}
                                        className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all"
                                    >
                                        Use This Information
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
