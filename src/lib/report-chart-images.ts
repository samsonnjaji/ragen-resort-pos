/**
 * Renders report charts to PNG (base64) via Chart.js for Excel embedding.
 * Client-only (requires document/canvas).
 */

import type { ReportModuleId } from "@/components/reports/report-modules";
import type { ReportExcelData } from "@/lib/report-excel-export";

export type ReportChartImage = {
  title: string;
  base64: string;
};

const EMERALD = "#059669";
const EMERALD_DARK = "#047857";
const GOLD = "#D4AF37";
const PALETTE = [EMERALD, GOLD, "#2563EB", "#DC2626", "#7C3AED", "#0891B2", EMERALD_DARK, "#CA8A04"];

const CHART_W = 520;
const CHART_H = 260;

async function createChart(config: Record<string, unknown>): Promise<string> {
  if (typeof document === "undefined") return "";
  const { Chart, registerables } = await import("chart.js");
  Chart.register(...registerables);

  const canvas = document.createElement("canvas");
  canvas.width = CHART_W;
  canvas.height = CHART_H;

  const baseOptions = (config.options as Record<string, unknown>) ?? {};
  const chartConfig = {
    ...config,
    options: {
      ...baseOptions,
      responsive: false,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        ...((baseOptions.plugins as Record<string, unknown>) ?? {}),
        legend: { labels: { color: "#0F172A", font: { size: 11 } } },
        title: {
          display: true,
          color: EMERALD_DARK,
          font: { size: 13, weight: "bold" },
        },
      },
    },
  };

  // Chart.js config is built dynamically per chart type
  const chart = new Chart(canvas, chartConfig as never);

  await new Promise((r) => setTimeout(r, 80));
  const dataUrl = canvas.toDataURL("image/png");
  chart.destroy();
  return dataUrl.replace(/^data:image\/png;base64,/, "");
}

async function lineChart(
  title: string,
  labels: string[],
  values: number[]
): Promise<ReportChartImage> {
  const base64 = await createChart({
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Revenue (KES)",
          data: values,
          borderColor: GOLD,
          backgroundColor: "rgba(212, 175, 55, 0.15)",
          fill: true,
          tension: 0.3,
          pointBackgroundColor: EMERALD,
          pointRadius: 4,
        },
      ],
    },
    options: {
      plugins: { title: { display: true, text: title } },
      scales: {
        x: { ticks: { color: "#64748B", maxRotation: 45 } },
        y: { ticks: { color: "#64748B" }, grid: { color: "#E2E8F0" } },
      },
    },
  });
  return { title, base64 };
}

async function barChart(
  title: string,
  labels: string[],
  values: number[],
  horizontal = false
): Promise<ReportChartImage> {
  const base64 = await createChart({
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "KES",
          data: values,
          backgroundColor: labels.map((_, i) => PALETTE[i % PALETTE.length]),
          borderRadius: 4,
        },
      ],
    },
    options: {
      indexAxis: horizontal ? "y" : "x",
      plugins: { title: { display: true, text: title }, legend: { display: false } },
      scales: {
        x: { ticks: { color: "#64748B" }, grid: { color: "#E2E8F0" } },
        y: { ticks: { color: "#64748B" }, grid: { color: horizontal ? "#E2E8F0" : undefined } },
      },
    },
  });
  return { title, base64 };
}

async function doughnutChart(title: string, labels: string[], values: number[]): Promise<ReportChartImage> {
  const base64 = await createChart({
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: labels.map((_, i) => PALETTE[i % PALETTE.length]),
          borderColor: "#FFFFFF",
          borderWidth: 2,
        },
      ],
    },
    options: {
      plugins: { title: { display: true, text: title } },
    },
  });
  return { title, base64 };
}

async function pieChart(title: string, labels: string[], values: number[]): Promise<ReportChartImage> {
  const base64 = await createChart({
    type: "pie",
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: labels.map((_, i) => PALETTE[i % PALETTE.length]),
          borderColor: "#FFFFFF",
          borderWidth: 2,
        },
      ],
    },
    options: {
      plugins: { title: { display: true, text: title } },
    },
  });
  return { title, base64 };
}

function emptyPlaceholder(title: string): ReportChartImage {
  return { title, base64: "" };
}

export async function buildReportChartImages(
  reportId: ReportModuleId,
  data: ReportExcelData
): Promise<ReportChartImage[]> {
  const images: ReportChartImage[] = [];

  switch (reportId) {
    case "sales": {
      const s = data.sales;
      if (!s) return [];
      if (s.revenueByDay.length > 0) {
        images.push(
          await lineChart(
            "Revenue by Day",
            s.revenueByDay.map((d) => d.date),
            s.revenueByDay.map((d) => d.revenue)
          )
        );
      } else {
        images.push(emptyPlaceholder("Revenue by Day"));
      }
      if (s.salesByCategory.length > 0) {
        images.push(
          await doughnutChart(
            "Sales by Category",
            s.salesByCategory.map((c) => c.name),
            s.salesByCategory.map((c) => c.value)
          )
        );
      } else {
        images.push(emptyPlaceholder("Sales by Category"));
      }
      if (s.topProducts.length > 0) {
        const top = s.topProducts.slice(0, 8);
        images.push(
          await barChart(
            "Top Products",
            top.map((p) => p.name),
            top.map((p) => p.revenue),
            true
          )
        );
      } else {
        images.push(emptyPlaceholder("Top Products"));
      }
      break;
    }

    case "payment": {
      const p = data.payment;
      if (!p) return [];
      const labels = ["Cash", "M-Pesa", "Card", "Bank"];
      const values = [p.cash, p.mpesa, p.card, p.bank];
      images.push(await doughnutChart("Payment Methods", labels, values));
      images.push(await barChart("Payment Comparison", labels, values));
      break;
    }

    case "inventory": {
      const inv = data.inventory;
      if (!inv) return [];
      if (inv.stockByCategory.length > 0) {
        images.push(
          await barChart(
            "Stock Value by Category (Retail)",
            inv.stockByCategory.map((c) => c.name),
            inv.stockByCategory.map((c) => c.retailValue)
          )
        );
      } else {
        images.push(emptyPlaceholder("Stock Value by Category"));
      }
      if (inv.lowStock.length > 0) {
        const low = inv.lowStock.slice(0, 10);
        images.push(
          await barChart(
            "Low Stock Items",
            low.map((p) => p.name),
            low.map((p) => p.stock),
            true
          )
        );
      } else {
        images.push(emptyPlaceholder("Low Stock Items"));
      }
      break;
    }

    case "occupancy": {
      const occ = data.occupancy;
      if (!occ) return [];
      const entries = Object.entries(occ.statusBreakdown).filter(([, v]) => v > 0);
      if (entries.length > 0) {
        images.push(
          await pieChart(
            "Room Occupancy",
            entries.map(([k]) => k.charAt(0).toUpperCase() + k.slice(1)),
            entries.map(([, v]) => v)
          )
        );
      } else {
        images.push(emptyPlaceholder("Room Occupancy"));
      }
      break;
    }

    case "profit": {
      const p = data.profit;
      if (!p) return [];
      images.push(
        await barChart("Revenue vs Expenses", ["Revenue", "COGS", "Expenses"], [p.revenue, p.cost, p.expenses])
      );
      break;
    }

    default:
      break;
  }

  return images.filter((img) => img.base64.length > 0);
}
