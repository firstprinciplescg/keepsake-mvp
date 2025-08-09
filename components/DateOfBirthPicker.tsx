'use client';
import { useEffect, useMemo, useState } from 'react';

type Props = {
  value?: string | null;              // ISO "YYYY-MM-DD" or null
  onChange: (iso: string | null) => void;
  minYear?: number;                   // default: currentYear - 120
  maxYear?: number;                   // default: currentYear (no future)
  required?: boolean;
  id?: string;
  label?: string;
};

const months = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
  { value: 4, label: 'April' },   { value: 5, label: 'May' },      { value: 6, label: 'June' },
  { value: 7, label: 'July' },    { value: 8, label: 'August' },   { value: 9, label: 'September' },
  { value: 10, label: 'October' },{ value: 11, label: 'November' },{ value: 12, label: 'December' },
];

function daysInMonth(y: number, m: number) {
  return new Date(y, m, 0).getDate(); // m is 1-12
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export default function DateOfBirthPicker({
  value,
  onChange,
  minYear,
  maxYear,
  required,
  id = 'dob',
  label = 'Date of birth',
}: Props) {
  const today = useMemo(() => new Date(), []);
  const curYear = today.getFullYear();
  const _minYear = minYear ?? curYear - 120;
  const _maxYear = Math.min(maxYear ?? curYear, curYear); // never beyond today’s year

  // Internal state
  const [y, setY] = useState<number | undefined>(undefined);
  const [m, setM] = useState<number | undefined>(undefined);
  const [d, setD] = useState<number | undefined>(undefined);

  // Hydrate from initial ISO value if present
  useEffect(() => {
    if (!value) return;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (match) {
      const [_all, yy, mm, dd] = match;
      setY(Number(yy));
      setM(Number(mm));
      setD(Number(dd));
    }
  }, [value]);

  // Recompute day options based on selected y/m (and prevent future dates)
  const dayCount = useMemo(() => {
    if (!y || !m) return 31;
    let max = daysInMonth(y, m);
    // If selected month/year is current month/year, cap by today's date
    if (y === curYear && m === (today.getMonth() + 1)) {
      max = Math.min(max, today.getDate());
    }
    return max;
  }, [y, m, curYear, today]);

  // Emit ISO on change
  useEffect(() => {
    if (y && m && d) {
      // Prevent future dates
      const candidate = new Date(`${y}-${pad(m)}-${pad(d)}T00:00:00Z`);
      const notFuture = candidate.getTime() <= Date.UTC(curYear, today.getMonth(), today.getDate());
      if (notFuture) {
        onChange(`${y}-${pad(m)}-${pad(d)}`);
        return;
      }
    }
    onChange(null);
  }, [y, m, d, curYear, today, onChange]);

  const years = useMemo(() => {
    const arr: number[] = [];
    for (let yy = _maxYear; yy >= _minYear; yy--) arr.push(yy);
    return arr;
  }, [_minYear, _maxYear]);

  // Adjust selected day if it exceeds the month’s max
  useEffect(() => {
    if (d && d > dayCount) setD(undefined);
  }, [dayCount, d]);

  return (
    <div className="w-full">
      <label htmlFor={id} className="block text-sm font-medium mb-1">{label}{required ? ' *' : ''}</label>
      <div className="grid grid-cols-3 gap-2">
        {/* Month */}
        <select
          aria-label="Month"
          className="border rounded p-2 bg-white"
          value={m ?? ''}
          onChange={e => setM(e.target.value ? Number(e.target.value) : undefined)}
          required={required}
        >
          <option value="">Month</option>
          {months.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* Day */}
        <select
          aria-label="Day"
          className="border rounded p-2 bg-white"
          value={d ?? ''}
          onChange={e => setD(e.target.value ? Number(e.target.value) : undefined)}
          required={required}
          disabled={!m}
        >
          <option value="">{m ? 'Day' : 'Day (select month first)'}</option>
          {Array.from({ length: dayCount }, (_, i) => i + 1).map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>

        {/* Year */}
        <select
          aria-label="Year"
          className="border rounded p-2 bg-white"
          value={y ?? ''}
          onChange={e => setY(e.target.value ? Number(e.target.value) : undefined)}
          required={required}
        >
          <option value="">Year</option>
          {years.map(yy => (
            <option key={yy} value={yy}>{yy}</option>
          ))}
        </select>
      </div>

      {/* Hidden form value (useful if you rely on form serialization) */}
      <input type="hidden" id={id} name="dob" value={y && m && d ? `${y}-${pad(m)}-${pad(d)}` : ''} />
      <p className="text-xs opacity-70 mt-1">We’ll never show this publicly. Future dates are not allowed.</p>
    </div>
  );
}
