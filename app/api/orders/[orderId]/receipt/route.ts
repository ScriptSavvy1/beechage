import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteParams = {
  params: Promise<{ orderId: string }>;
};

export async function GET(_req: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderId } = await params;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      createdBy: { select: { name: true, email: true } },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Reception can only see own orders
  if (session.user.role === "RECEPTION" && order.createdById !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const totalAmount = order.totalAmount.toNumber();
  const paidAmount = order.paidAmount.toNumber();
  const remaining = totalAmount - paidAmount;
  const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeStyle: "short" });
  const fmt = (n: number) => `$${n.toFixed(2)}`;

  const itemRows = order.items
    .map(
      (item) => `
      <tr>
        <td>${item.categoryName}</td>
        <td>${item.itemName}</td>
        <td style="text-align:center">${item.quantity}</td>
        <td style="text-align:right">${fmt(item.unitPrice.toNumber())}</td>
        <td style="text-align:right">${fmt(item.lineTotal.toNumber())}</td>
      </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Receipt — ${order.orderNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      color: #1a1a1a;
      padding: 24px;
      max-width: 600px;
      margin: 0 auto;
    }
    h1 { font-size: 20px; margin-bottom: 4px; }
    .meta { color: #666; font-size: 12px; margin-bottom: 16px; }
    .section { margin-bottom: 16px; }
    .section-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #888;
      margin-bottom: 6px;
    }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 6px 8px; text-align: left; }
    th {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #888;
      border-bottom: 1px solid #ddd;
    }
    td { border-bottom: 1px solid #f0f0f0; }
    .totals td { border-bottom: none; font-weight: 600; }
    .totals .remaining { color: ${remaining > 0 ? "#dc2626" : "#16a34a"}; }
    .footer {
      text-align: center;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #ddd;
      color: #999;
      font-size: 11px;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom:16px">
    <button onclick="window.print()" style="padding:8px 16px;font-size:13px;cursor:pointer;border:1px solid #ccc;border-radius:6px;background:#fff">
      🖨️ Print
    </button>
  </div>

  <h1>Receipt</h1>
  <p class="meta">
    Order <strong>${order.orderNumber}</strong> &bull;
    ${dateFmt.format(order.createdAt)}
  </p>

  <div class="section">
    <p class="section-title">Customer</p>
    <p><strong>${order.customerName}</strong></p>
    <p>${order.customerPhone}</p>
  </div>

  ${order.notes ? `<div class="section"><p class="section-title">Notes</p><p>${order.notes}</p></div>` : ""}

  <div class="section">
    <p class="section-title">Items</p>
    <table>
      <thead>
        <tr>
          <th>Category</th>
          <th>Item</th>
          <th style="text-align:center">Qty</th>
          <th style="text-align:right">Unit</th>
          <th style="text-align:right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>
  </div>

  <div class="section">
    <table class="totals">
      <tr>
        <td>Total</td>
        <td style="text-align:right">${fmt(totalAmount)}</td>
      </tr>
      <tr>
        <td>Paid</td>
        <td style="text-align:right">${fmt(paidAmount)}</td>
      </tr>
      <tr>
        <td>Remaining</td>
        <td class="remaining" style="text-align:right">${fmt(remaining)}</td>
      </tr>
    </table>
  </div>

  <div class="footer">
    <p>Served by ${order.createdBy.name || order.createdBy.email}</p>
    <p>Thank you for choosing our service!</p>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
