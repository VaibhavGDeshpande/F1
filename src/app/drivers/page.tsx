import { DriverCard } from "@/components/Cards";
import { roster } from "@/lib/roster";

export const metadata = { title: "Drivers" };

export default async function Drivers() {
  const drivers = await roster();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="h1">Drivers</h1>
        <p className="muted text-sm">This season&apos;s grid in championship order. Open a driver for race-by-race results, engine parts used and news.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {drivers.filter((d) => d.active).map((d) => <DriverCard key={d.id} d={d} />)}
      </div>
      {drivers.some((d) => !d.active) && (
        <section>
          <h2 className="h2 mt-4">Also scored points this season</h2>
          <div className="grid gap-4 opacity-70 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {drivers.filter((d) => !d.active).map((d) => <DriverCard key={d.id} d={d} />)}
          </div>
        </section>
      )}
    </div>
  );
}
