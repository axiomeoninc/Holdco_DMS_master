// Type stub for the OpenNext-generated worker module. Real module is
// emitted at .open-next/worker.js after `npm run build:cf`. The stub
// keeps `tsc` happy during type-check (relative ambient declarations are
// not matched under moduleResolution: "bundler").
declare module "*/worker.js" {
    const worker: {
        fetch: (request: Request, env: Record<string, unknown>, ctx: { waitUntil: (promise: Promise<unknown>) => void }) => Promise<Response>;
    };
    export default worker;
}
