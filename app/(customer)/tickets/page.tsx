import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";
import { RoleSection } from "@/components/role-section";
import { buttonVariants } from "@/components/ui/button";
import { formatDate, formatTime } from "@/lib/admin/format";
import { ROLES } from "@/lib/auth/roles";
import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "ตั๋วของฉัน" };

async function TicketList() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, order_no, order_items(id, quantity, products(name)), tickets(id, qr_token, status, seats(row_label, seat_number), showtimes(starts_at, movies(title), theaters(name)))",
    )
    .eq("customer_id", profile?.id ?? "")
    .eq("status", "paid")
    .order("created_at", { ascending: false });

  const tickets = await Promise.all(
    (orders ?? []).flatMap((order) =>
      order.tickets.map(async (ticket) => ({
        ...ticket,
        order,
        qrImage: ticket.qr_token
          ? await QRCode.toDataURL(ticket.qr_token, { width: 220, margin: 1 })
          : null,
      })),
    ),
  );

  if (!tickets.length) {
    return (
      <>
        <h1 className="text-2xl font-semibold">ตั๋วของฉัน</h1>
        <p className="mt-2 text-muted-foreground">ยังไม่มีตั๋ว</p>
        <Link href="/" className={`mt-4 ${buttonVariants()}`}>
          เลือกหนัง
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">ตั๋วของฉัน</h1>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tickets.map((ticket) => (
          <li
            key={ticket.id}
            className="flex flex-col items-center gap-2 rounded-lg border p-4 text-center"
          >
            <div className="font-medium">{ticket.showtimes.movies.title}</div>
            <div className="text-sm text-muted-foreground">
              {ticket.showtimes.theaters.name} · ที่นั่ง {ticket.seats.row_label}
              {ticket.seats.seat_number}
              <br />
              {formatDate(ticket.showtimes.starts_at)}{" "}
              {formatTime(ticket.showtimes.starts_at)}
            </div>
            {ticket.qrImage ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URL ที่สร้างบนเซิร์ฟเวอร์
              <img
                src={ticket.qrImage}
                alt={`QR ตั๋วที่นั่ง ${ticket.seats.row_label}${ticket.seats.seat_number}`}
                className="size-44"
              />
            ) : null}
            <div className="text-xs text-muted-foreground">
              {ticket.order.order_no}
              {ticket.status === "used" ? " · ใช้แล้ว" : ""}
            </div>
            {ticket.order.order_items.length ? (
              <div className="text-xs text-muted-foreground">
                รับสินค้าด้วยหมายเลขนี้:{" "}
                {ticket.order.order_items
                  .map((item) => `${item.products.name} × ${item.quantity}`)
                  .join(", ")}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}

export default function TicketsPage() {
  return (
    <RoleSection section="ตั๋วของฉัน" allowed={ROLES} path="/tickets">
      <TicketList />
    </RoleSection>
  );
}
