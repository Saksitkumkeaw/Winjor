import type { Metadata } from "next";
import { AdminSection } from "@/components/admin/admin-section";
import { RefundForm } from "@/components/admin/refund-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { markPaymentRefunded } from "@/lib/admin/actions";
import { formatBaht, formatDate, formatTime } from "@/lib/admin/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "คำสั่งซื้อ" };

const STATUS_LABEL = {
  pending: "รอชำระเงิน",
  paid: "ชำระแล้ว",
  expired: "หมดเวลา",
  cancelled: "ยกเลิก",
  refunded: "คืนเงินแล้ว",
};

const METHOD_LABEL = {
  card: "บัตร",
  promptpay: "PromptPay",
  cash: "เงินสด",
};

const MAX_ROWS = 50;

async function Orders({
  searchParams,
}: Pick<PageProps<"/admin/orders">, "searchParams">) {
  const { q } = await searchParams;
  const search = typeof q === "string" ? q.trim().toUpperCase() : "";

  const supabase = await createClient();
  let query = supabase
    .from("orders")
    .select(
      "id, order_no, channel, status, total, created_at, payments(method, status), order_items(id, quantity, products(name)), tickets(id, status, seats(row_label, seat_number), showtimes(starts_at, status, movies(title), theaters(name)))",
    )
    .order("created_at", { ascending: false })
    .limit(MAX_ROWS);
  if (search) query = query.ilike("order_no", `%${search}%`);

  const [{ data: orders }, { data: pendingRefunds }, { data: cancelledTickets }] =
    await Promise.all([
      query,
      supabase
        .from("payments")
        .select("id, method, amount, refund_reason, orders(order_no)")
        .eq("needs_refund", true)
        .order("created_at"),
      supabase
        .from("tickets")
        .select(
          "orders!inner(order_no, status), showtimes!inner(starts_at, status, movies(title))",
        )
        .eq("showtimes.status", "cancelled")
        .eq("orders.status", "paid"),
    ]);

  const cancelledOrders = new Map(
    cancelledTickets?.map((ticket) => [ticket.orders.order_no, ticket.showtimes]),
  );

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold">คำสั่งซื้อ</h1>
        <form className="flex items-center gap-2">
          <Input
            key={search}
            name="q"
            aria-label="ค้นหาหมายเลขคำสั่งซื้อ"
            placeholder="เช่น WJ-000123"
            defaultValue={search}
          />
          <Button type="submit" variant="outline">
            ค้นหา
          </Button>
        </form>
      </div>

      {cancelledOrders.size ? (
        <section className="mb-4 rounded-lg border border-red-600 bg-red-50 p-3 text-red-950">
          <h2 className="font-semibold">
            รอบฉายถูกยกเลิก ยังต้องคืนเงิน {cancelledOrders.size} รายการ
          </h2>
          <ul className="mt-1 text-sm">
            {[...cancelledOrders].map(([orderNo, showtime]) => (
              <li key={orderNo}>
                {orderNo} · {showtime.movies.title} ·{" "}
                {formatDate(showtime.starts_at)} {formatTime(showtime.starts_at)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {pendingRefunds?.length ? (
        <section className="mb-4 rounded-lg border border-red-600 p-3">
          <h2 className="font-semibold">รายการที่ต้องคืนเงินเอง</h2>
          <ul className="mt-2 divide-y text-sm">
            {pendingRefunds.map((payment) => (
              <li
                key={payment.id}
                className="flex items-center justify-between gap-3 py-2"
              >
                <span>
                  {payment.orders.order_no} · {formatBaht(payment.amount)} ·{" "}
                  {payment.refund_reason}
                </span>
                <form action={markPaymentRefunded}>
                  <input type="hidden" name="id" value={payment.id} />
                  <Button type="submit" variant="outline" size="sm">
                    คืนเงินแล้ว
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {orders?.length ? (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-4xl text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="p-2 font-medium">หมายเลข</th>
                <th className="p-2 font-medium">รายการ</th>
                <th className="p-2 font-medium">ยอด</th>
                <th className="p-2 font-medium">สถานะ</th>
                <th className="p-2 font-medium">คืนเงิน</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const showtime = order.tickets[0]?.showtimes;
                const seats = order.tickets
                  .filter((ticket) => ticket.status !== "released")
                  .map(
                    (ticket) =>
                      `${ticket.seats.row_label}${ticket.seats.seat_number}`,
                  );
                const paid = order.payments.filter(
                  (payment) => payment.status !== "failed",
                );
                const needsCancelRefund =
                  order.status === "paid" && showtime?.status === "cancelled";

                return (
                  <tr
                    key={order.id}
                    className={cn(
                      "border-t align-top",
                      needsCancelRefund && "bg-red-50 text-red-950",
                    )}
                  >
                    <td className="p-2 whitespace-nowrap">
                      <div className="font-medium">{order.order_no}</div>
                      <div className="text-xs opacity-70">
                        {formatDate(order.created_at)}{" "}
                        {formatTime(order.created_at)}
                      </div>
                      <div className="text-xs opacity-70">
                        {order.channel === "pos" ? "หน้าร้าน" : "ออนไลน์"}
                      </div>
                    </td>
                    <td className="p-2">
                      {showtime ? (
                        <>
                          <div className="font-medium">
                            {showtime.movies.title}
                          </div>
                          <div>
                            {showtime.theaters.name} ·{" "}
                            {formatDate(showtime.starts_at)}{" "}
                            {formatTime(showtime.starts_at)}
                            {seats.length ? ` · ที่นั่ง ${seats.join(", ")}` : ""}
                          </div>
                        </>
                      ) : null}
                      {order.order_items.length ? (
                        <div className="text-xs opacity-70">
                          {order.order_items
                            .map(
                              (item) =>
                                `${item.products.name} × ${item.quantity}`,
                            )
                            .join(", ")}
                        </div>
                      ) : null}
                      {needsCancelRefund ? (
                        <div className="mt-1 font-semibold">
                          รอบฉายถูกยกเลิก ต้องคืนเงิน
                        </div>
                      ) : null}
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      {formatBaht(order.total)}
                      <div className="text-xs opacity-70">
                        {paid
                          .map((payment) => METHOD_LABEL[payment.method])
                          .join(", ")}
                      </div>
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      {STATUS_LABEL[order.status]}
                    </td>
                    <td className="p-2">
                      {order.status === "paid" ? (
                        <RefundForm
                          orderId={order.id}
                          manual={order.payments.some(
                            (payment) =>
                              payment.status === "succeeded" &&
                              payment.method !== "card",
                          )}
                        />
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-muted-foreground">ไม่พบคำสั่งซื้อ</p>
      )}
    </>
  );
}

export default function OrdersPage({
  searchParams,
}: PageProps<"/admin/orders">) {
  return (
    <AdminSection path="/admin/orders">
      <Orders searchParams={searchParams} />
    </AdminSection>
  );
}
