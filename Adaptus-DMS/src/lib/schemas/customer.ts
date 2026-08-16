import { z } from "zod";

export const customerFormSchema = z.object({
    name: z.string().trim().min(1, "Name is required").max(200),
    email: z
        .string()
        .trim()
        .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
            message: "Enter a valid email",
        }),
    phone: z.string().trim().max(40),
    address: z.string().trim().max(300),
    city: z.string().trim().max(100),
    province: z.string().trim().max(40),
    postal_code: z.string().trim().max(20),
    notes: z.string().trim().max(5000),
    assigned_to: z.string(),
    marketing_consent: z.boolean(),
    sms_consent: z.boolean(),
});

export type CustomerFormValues = z.infer<typeof customerFormSchema>;
