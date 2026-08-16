export default function AuthLayout({
    children
}: {
    children: React.ReactNode;
}) {
    // Passthrough: login owns full-bleed viewport (lg:grid lg:grid-cols-2).
    // Brand lockups live on login / register / forgot / verify via BrandLogo.
    return children;
}
