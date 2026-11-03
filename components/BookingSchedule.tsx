import type { BookingSlot } from '@/lib/bookings';
import { dayKeyOf, formatSlotRange, getShopMonth } from '@/lib/bookings';

/**
 * 预约时间表（前台公开区块）
 *
 * 数据来自 booking_slots 视图，只有「什么时候被约了」，
 * 没有备注、没有样图——顾客隐私不会从这一页漏出去。
 *
 * 展示策略（与需求约定）：
 * - 固定显示当月月历
 * - 月底（剩余 ≤ 7 天）或下个月已有预约时，加挂下月月历
 * - 周一标记「休」（周一店休，见 data/site.ts 的营业说明）
 * - 过去的日期置灰，今天高亮
 */

interface BookingScheduleProps {
  slots: BookingSlot[];
}

/** 一周从周一开始（国内习惯），返回该月 1 号前面要空几格 */
function leadingBlanks(year: number, month0: number): number {
  const weekday = new Date(Date.UTC(year, month0, 1)).getUTCDay(); // 0 = 周日
  return (weekday + 6) % 7; // 转成周一为 0
}

function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

interface MonthModel {
  year: number;
  month0: number;
  label: string;
}

function MonthCalendar({
  model,
  slotsByDay,
  todayKey,
}: {
  model: MonthModel;
  slotsByDay: Map<string, BookingSlot[]>;
  todayKey: string;
}) {
  const { year, month0 } = model;
  const total = daysInMonth(year, month0);
  const blanks = leadingBlanks(year, month0);
  const pad = (n: number) => String(n).padStart(2, '0');

  const cells: (number | null)[] = [
    ...Array.from({ length: blanks }, () => null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];

  return (
    <div className="cal">
      <p className="cal__label">{model.label}</p>
      <div className="cal__weekdays" aria-hidden="true">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <ol className="cal__grid">
        {cells.map((day, index) => {
          if (day === null) {
            return <li key={`blank-${index}`} className="cal__cell cal__cell--blank" aria-hidden="true" />;
          }

          const key = `${year}-${pad(month0 + 1)}-${pad(day)}`;
          const daySlots = slotsByDay.get(key) ?? [];
          const isToday = key === todayKey;
          const isPast = key < todayKey;
          const isMonday = index % 7 === 0;

          return (
            <li
              key={key}
              className={[
                'cal__cell',
                isToday ? 'is-today' : '',
                isPast ? 'is-past' : '',
                daySlots.length > 0 ? 'is-booked' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="cal__day">
                {day}
                {isMonday ? <em className="cal__off">休</em> : null}
              </span>
              {daySlots.length > 0 ? (
                <ul className="cal__chips">
                  {daySlots.map((slot) => (
                    <li key={slot.id} className="cal__chip">
                      {formatSlotRange(slot)}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default function BookingSchedule({ slots }: BookingScheduleProps) {
  const now = new Date();
  const { year, month0 } = getShopMonth(now);
  const todayKey = dayKeyOf(now);

  // 当月剩余天数 ≤ 7 视为「月底」，加挂下月；下个月已有预约时也加挂
  const todayDay = Number(todayKey.slice(-2));
  const daysLeft = daysInMonth(year, month0) - todayDay;
  const nextYear = month0 === 11 ? year + 1 : year;
  const nextMonth0 = (month0 + 1) % 12;
  const nextPrefix = `${nextYear}-${String(nextMonth0 + 1).padStart(2, '0')}-`;
  const nextMonthHasSlots = slots.some((slot) => dayKeyOf(new Date(slot.starts_at)).startsWith(nextPrefix));
  const showNextMonth = daysLeft <= 7 || nextMonthHasSlots;

  const months: MonthModel[] = [
    { year, month0, label: `${year} 年 ${month0 + 1} 月` },
  ];
  if (showNextMonth) {
    months.push({ year: nextYear, month0: nextMonth0, label: `${nextYear} 年 ${nextMonth0 + 1} 月` });
  }

  // 按「店内的日」分组，同一天多个时段都放进格子
  const slotsByDay = new Map<string, BookingSlot[]>();
  for (const slot of slots) {
    const key = dayKeyOf(new Date(slot.starts_at));
    const list = slotsByDay.get(key) ?? [];
    list.push(slot);
    slotsByDay.set(key, list);
  }

  return (
    <section className="section schedule" id="schedule">
      <div className="container">
        <div className="section__head">
          <div>
            <p className="eyebrow">Schedule</p>
            <h2 className="section__title">预约时间表</h2>
          </div>
          <p className="section__desc">
            标了时间段的格子是已经被约走的。想约的话，避开这些时间直接微信说就行。
          </p>
        </div>

        <div className="schedule__months">
          {months.map((model) => (
            <MonthCalendar
              key={`${model.year}-${model.month0}`}
              model={model}
              slotsByDay={slotsByDay}
              todayKey={todayKey}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
