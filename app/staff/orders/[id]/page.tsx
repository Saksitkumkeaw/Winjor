import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { PosPayment } from "@/components/staff/pos-payment";
import { StaffSection } from "@/components/staff/staff-section";
import { buttonVariants } from "@/components/ui/button";
import { formatBaht, formatDate, formatTime } from "@/lib/admin/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "รับเงิน" };

async function PosOrder({
  params,
}: Pick<PageProps<"/staff/orders/[id]">, "params">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, order_no, status, total, order_items(id, quantity, unit_price, products(name)), tickets(id, price, qr_token, seats(row_label, seat_number), showtimes(starts_at, movies(title), theaters(name)))",
    )
    .eq("id", id)
    .maybeSingle();

  if (!order) notFound();

  const tickets = await Promise.all(
    order.tickets.map(async (ticket) => ({
      ...ticket,
      qrImage: ticket.qr_token
        ? await QRCode.toDataURL(ticket.qr_token, { width: 200, margin: 1 })
        : null,
    })),
  );

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section>
        <h1 className="text-2xl font-semibold">{order.order_no}</h1>
        <ul className="mt-3 divide-y rounded-lg border text-sm">
          {tickets.map((ticket) => (
            <li key={ticket.id} className="flex justify-between gap-3 p-2">
              <span>
                {ticket.showtimes.movies.title} ·{" "}
                {formatDate(ticket.showtimes.starts_at)}{" "}
                {formatTime(ticket.showtimes.starts_at)} · ที่นั่ง{" "}
                {ticket.seats.row_label}
                {ticket.seats.seat_number}
              </span>
              <span>{formatBaht(ticket.price)}</span>
            </li>
          ))}
          {order.order_items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3 p-2">
              <span>
                {item.products.name} × {item.quantity}
              </span>
              <span>{formatBaht(item.unit_price * item.quantity)}</span>
            </li>
          ))}
          <li className="flex justify-between gap-3 p-2 font-semibold">
            <span>รวม</span>
            <span>{formatBaht(order.total)}</span>
          </li>
        </ul>
      </section>

      <section>
        {order.status === "pending" ? (
          <PosPayment orderId={order.id} total={order.total} />
        ) : order.status === "paid" ? (
          <div className="flex flex-col gap-3">
            <p className="rounded-lg border border-emerald-600 bg-emerald-50 p-3 font-semibold text-emerald-950">
              ชำระเงินแล้ว
            </p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {tickets.map((ticket) =>
                ticket.qrImage ? (
                  <li
                    key={ticket.id}
                    className="flex flex-col items-center gap-1 rounded-lg border p-3 text-sm"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- data URL ที่สร้างบนเซิร์ฟเวอร์ */}
                    <img
                      src={ticket.qrImage}
                      alt={`QR ตั๋วที่นั่ง ${ticket.seats.row_label}${ticket.seats.seat_number}`}
                      className="size-36"
                    />
                    ที่นั่ง {ticket.seats.row_label}
                    {ticket.seats.seat_number}
                  </li>
                ) : null,
              )}
            </ul>
            <Link href="/staff" className={buttonVariants()}>
              ขายรายการถัดไป
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-muted-foreground">รายการนี้สิ้นสุดแล้ว</p>
            <Link href="/staff" className={buttonVariants()}>
              กลับหน้าขาย
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

export default function PosOrderPage({
  params,
}: PageProps<"/staff/orders/[id]">) {
  return (
    <StaffSection path="/staff">
      <PosOrder params={params} />
    </StaffSection>
  );
}
