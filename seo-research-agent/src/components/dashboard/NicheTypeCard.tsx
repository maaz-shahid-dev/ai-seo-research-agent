import { Coins, Compass, ShieldAlert } from "lucide-react";

import { NICHE_TYPE_PROFILES, type NicheType } from "@/features/research/niche-types";
import { Card } from "@/components/ui/Card";

/** What kind of niche this is, and how sites in it make money and win. */
export function NicheTypeCard({ type }: { type: NicheType }) {
  const profile = NICHE_TYPE_PROFILES[type];
  return (
    <Card as="section" aria-labelledby="niche-type-title">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Niche type</p>
      <h2 id="niche-type-title" className="mt-1 text-lg font-semibold text-slate-950">{profile.label}</h2>
      <p className="mt-1 text-sm text-slate-600">{profile.summary}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <List icon={Coins} title="How it makes money" items={profile.monetization} />
        <List icon={Compass} title="Winning strategy" items={profile.strategy} />
        <List icon={ShieldAlert} title="Watch out for" items={profile.cautions} />
      </div>
    </Card>
  );
}

function List({ icon: Icon, title, items }: { icon: typeof Coins; title: string; items: readonly string[] }) {
  return (
    <div>
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {title}
      </h3>
      <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-700">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}
