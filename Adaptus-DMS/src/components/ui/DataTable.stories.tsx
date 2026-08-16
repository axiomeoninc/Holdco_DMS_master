import type { Meta, StoryObj } from "@storybook/react";
import {
  DataTable,
  DataTableBody,
  DataTableHead,
  DataTableHeaderRow,
  DataTableRow,
  DataTableScroll,
  DataTableShell,
  DataTableTd,
  DataTableTdNum,
  DataTableTh,
  dataTableIdentityClass,
  dataTableVinClass,
} from "./DataTable";
import { Skeleton } from "./Skeleton";
import { Inbox } from "lucide-react";

const meta = {
  title: "Gold/DataTable",
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const rows = [
  { year: 2024, make: "Toyota", model: "Camry SE", vin: "4T1G11AK5RU123456", price: 28990 },
  { year: 2023, make: "Honda", model: "CR-V EX", vin: "7FARW2H85PE654321", price: 31950 },
  { year: 2022, make: "Ford", model: "F-150 XLT", vin: "1FTFW1E85NFA99887", price: 42900 },
];

export const WithRows: Story = {
  render: () => (
    <DataTableShell className="max-w-3xl">
      <DataTableScroll>
        <DataTable>
          <DataTableHead>
            <DataTableHeaderRow>
              <DataTableTh>Vehicle</DataTableTh>
              <DataTableTh className="text-right">Price</DataTableTh>
            </DataTableHeaderRow>
          </DataTableHead>
          <DataTableBody>
            {rows.map((row) => (
              <DataTableRow key={row.vin}>
                <DataTableTd>
                  <div className={dataTableIdentityClass}>
                    {row.year} {row.make} {row.model}
                  </div>
                  <div className={dataTableVinClass}>{row.vin}</div>
                </DataTableTd>
                <DataTableTdNum>
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                    maximumFractionDigits: 0,
                  }).format(row.price)}
                </DataTableTdNum>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      </DataTableScroll>
    </DataTableShell>
  ),
};

export const SkeletonRows: Story = {
  render: () => (
    <DataTableShell className="max-w-3xl">
      <DataTableScroll>
        <DataTable>
          <DataTableHead>
            <DataTableHeaderRow>
              <DataTableTh>Vehicle</DataTableTh>
              <DataTableTh className="text-right">Price</DataTableTh>
            </DataTableHeaderRow>
          </DataTableHead>
          <DataTableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <DataTableRow key={i}>
                <DataTableTd>
                  <Skeleton className="mb-1.5 h-4 w-48" />
                  <Skeleton className="h-3 w-36" />
                </DataTableTd>
                <DataTableTdNum>
                  <Skeleton className="ml-auto h-4 w-16" />
                </DataTableTdNum>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      </DataTableScroll>
    </DataTableShell>
  ),
};

export const Empty: Story = {
  render: () => (
    <DataTableShell className="max-w-3xl p-10">
      <div className="flex flex-col items-center justify-center gap-2 text-center">
        <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium text-foreground">No vehicles yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Add your first unit to start building inventory.
        </p>
      </div>
    </DataTableShell>
  ),
};
