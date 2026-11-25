import { PU_ELEMENTS, PU_LIMITS, type PuRow } from "@/lib/fia-parse";

/** PU element usage; amber = at the season limit (next one is a grid penalty), red = over the limit. */
export function PuTable({ rows }: { rows: PuRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="tbl">
        <thead>
          <tr>
            <th>Car</th><th>Team / driver</th>
            {PU_ELEMENTS.map((e) => <th key={e} className="text-center">{e}{PU_LIMITS[e] != null && <span className="text-neutral-600"> /{PU_LIMITS[e]}</span>}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.car}>
              <td className="font-mono">{r.car}</td>
              <td>{r.name}</td>
              {PU_ELEMENTS.map((e) => {
                const limit = PU_LIMITS[e], n = r.used[e];
                const cls = limit == null ? "" : n > limit ? "bg-red-500/20 text-red-300" : n === limit ? "bg-amber-500/20 text-amber-300" : "";
                return <td key={e} className={`text-center font-mono ${cls}`} title={limit == null ? "season limit not stated in FIA reports" : n > limit ? "over the limit — penalty taken" : n === limit ? "at the limit — next element = grid penalty" : ""}>{n}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
