import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckoutPanel } from "@/components/booking/checkout-panel";
import { RoleSection } from "@/components/role-section";
import { buttonVariants } from "@/components/ui/button";
import { formatBaht, formatDate, formatTime } from "@/lib/admin/format";
import { ROLES } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "ชำระเงิน" };

async function Checkout({
  params,
}: Pick<PageProps<"/checkout/[id]">, "params">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, order_no, status, total, expires_at, tickets(id, price, status, seats(row_label, seat_number), showtimes(starts_at, movies(title), theaters(name))), order_items(id, quantity, unit_price, products(name))",
    )
    .eq("id", id)
    .maybeSingle();

  if (!order) notFound();
  if (order.status === "paid") redirect("/tickets");

  if (order.status !== "pending") {
    return (
      <>
        <h1 className="text-2xl font-semibold">การจองนี้สิ้นสุดแล้ว</h1>
        <p className="mt-2 text-muted-foreground">
          ที่นั่งถูกปล่อยแล้ว กรุณาเลือกที่นั่งใหม่
        </p>
        <Link href="/" className={`mt-4 ${buttonVariants()}`}>
          กลับหน้าแรก
        </Link>
      </>
    );
  }

  const tickets = order.tickets.filter((ticket) => ticket.status === "held");
  const showtime = tickets[0]?.showtimes;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section>
        <h1 className="text-2xl font-semibold">สรุปการจอง</h1>
        <p className="mt-1 text-sm text-muted-foreground">{order.order_no}</p>
        {showtime ? (
          <p className="mt-3">
            <span className="font-medium">{showtime.movies.title}</span>
            <br />
            {showtime.theaters.name} · {formatDate(showtime.starts_at)}{" "}
            {formatTime(showtime.starts_at)}
          </p>
        ) : null}
        <ul className="mt-3 divide-y rounded-lg border text-sm">
          {tickets.map((ticket) => (
            <li key={ticket.id} className="flex justify-between gap-3 p-2">
              <span>
                ที่นั่ง {ticket.seats.row_label}
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
        <h2 className="mb-3 text-lg font-semibold">ชำระเงิน</h2>
        <CheckoutPanel orderId={order.id} expiresAt={order.expires_at} />
      </section>
    </div>
  );
}

export default function CheckoutPage({ params }: PageProps<"/checkout/[id]">) {
  return (
    <RoleSection section="ชำระเงิน" allowed={ROLES} path="/">
      <Checkout params={params} />
    </RoleSection>
  );
}
