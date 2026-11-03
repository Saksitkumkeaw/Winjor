import { formatQty } from "./parts";

const CHART_HEIGHT = 160;

function dayLabel(date: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
  }).format(new Date(`${date}T00:00:00+07:00`));
}

// ยอดใช้รายวันพร้อมเส้นค่าเฉลี่ย (d)
export function UsageChart({
  dates,
  values,
  average,
  unit,
}: {
  dates: string[];
  values: number[];
  average: number;
  unit: string;
}) {
  const max = Math.max(...values, average, 1);

  return (
    <figure>
      <div className="relative" style={{ height: CHART_HEIGHT }}>
        <span className="absolute top-0 right-0 bg-background pl-1 text-xs text-muted-foreground">
          {formatQty(max, unit)}
        </span>
        <div className="absolute inset-0 flex items-end gap-px border-b">
          {values.map((value, index) => (
            <span
              key={dates[index]}
              title={`${dayLabel(dates[index])}: ${formatQty(value, unit)}`}
              className="min-w-0 flex-1 rounded-t-sm bg-sky-600/80"
              style={{ height: `${(value / max) * 100}%` }}
            />
          ))}
        </div>
        <div
          className="absolute inset-x-0 border-t-2 border-dashed border-amber-600"
          style={{ bottom: `${(average / max) * 100}%` }}
        >
          <span className="absolute -top-5 left-0 rounded bg-background px-1 text-xs font-medium text-amber-800">
            ค่าเฉลี่ย {formatQty(average, unit)}/วัน
          </span>
        </div>
      </div>
      <figcaption className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>{dates.length ? dayLabel(dates[0]) : ""}</span>
        <span>ยอดใช้รายวัน {dates.length} วัน</span>
        <span>{dates.length ? dayLabel(dates[dates.length - 1]) : ""}</span>
      </figcaption>
    </figure>
  );
}
