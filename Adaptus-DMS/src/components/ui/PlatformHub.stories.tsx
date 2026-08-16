import type { Meta, StoryObj } from "@storybook/react";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Shield,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { StatCard } from "./StatCard";

const meta = {
  title: "Gold/PlatformHub",
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

type HubLink = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

const TOOLS: HubLink[] = [
  {
    href: "#analytics",
    title: "Analytics",
    description: "Platform metrics, revenue, and dealership performance",
    icon: BarChart3,
  },
  {
    href: "#impersonate",
    title: "Impersonate",
    description: "View the product as another user for support",
    icon: UserCheck,
  },
  {
    href: "#dealerships",
    title: "Dealerships",
    description: "Create and manage tenant dealerships",
    icon: Building2,
  },
  {
    href: "#users",
    title: "Users",
    description: "Browse and manage users across dealerships",
    icon: Users,
  },
];

function HubCard({ href, title, description, icon: Icon }: HubLink) {
  return (
    <a
      href={href}
      className="group flex flex-col rounded-lg border border-border bg-card p-5 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-[#00AEEF]/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00AEEF]"
    >
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#00AEEF]/30 bg-[#00AEEF]/10 text-[#00AEEF] transition-colors group-hover:bg-[#00AEEF]/15">
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <h3 className="text-base font-semibold text-foreground group-hover:text-[#00AEEF]">
        {title}
      </h3>
      <p className="mt-1 flex-1 text-sm text-muted-foreground">{description}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[#00AEEF]">
        Open
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </a>
  );
}

export const HubCardGrid: Story = {
  render: () => (
    <div className="max-w-4xl space-y-3 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Shield className="h-4 w-4" aria-hidden />
        Platform tools
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {TOOLS.map((tool) => (
          <HubCard key={tool.href} {...tool} />
        ))}
      </div>
    </div>
  ),
};

export const StatCardGrid: Story = {
  render: () => (
    <div className="grid max-w-4xl grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard label="Active dealerships" value={42} delta={4.2} deltaLabel="vs last month" icon={Building2} />
      <StatCard label="Platform users" value={1284} format="compact" delta={-1.1} deltaLabel="vs last week" icon={Users} />
      <StatCard label="MRR" value={186400} format="currency" delta={6.8} deltaLabel="vs prior period" icon={BarChart3} />
      <StatCard label="Loading tile" value={0} loading icon={Shield} />
    </div>
  ),
};
