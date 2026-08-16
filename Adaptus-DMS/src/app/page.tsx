import { redirect } from "next/navigation";

export default function Home() {
    // Send authed users to the app shell. Unauthenticated visitors never reach
    // here — middleware redirects them to /login?next=/.
    redirect("/dashboard");
}
