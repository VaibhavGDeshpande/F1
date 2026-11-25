import { COMPOUND_COLOURS } from "@/lib/openf1";

const Item = ({ colour, label, round = true }: { colour: string; label: string; round?: boolean }) => (
  <span className="inline-flex items-center gap-1.5">
    <span className={`inline-block h-2.5 w-2.5 ${round ? "rounded-full" : "rounded-sm"}`} style={{ background: colour }} />{label}
  </span>
);

/** Explains tyre compound colours. */
export function TyreLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-[11px] text-neutral-400">
      {Object.entries(COMPOUND_COLOURS).map(([c, col]) => <Item key={c} colour={col} label={c[0] + c.slice(1).toLowerCase()} />)}
    </div>
  );
}

/** Explains timing-tower sector colours and columns. */
export function TimingLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-neutral-400">
      <Item colour="#c084fc" label="Fastest of anyone" round={false} />
      <Item colour="#4ade80" label="Driver's personal best" round={false} />
      <Item colour="#fde047" label="Slower than their best" round={false} />
      <span><b className="text-neutral-300">Gap</b> = behind the leader · <b className="text-neutral-300">Int</b> = behind the car ahead · <b className="text-neutral-300">Tyre</b> = compound + laps on it</span>
    </div>
  );
}
