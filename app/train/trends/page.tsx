import { getTrendsData } from "@/app/_lib/actions/training.actions";
import TrendsView from "../_components/TrendsView";
import type { TrendRow, TrendSession } from "../_components/TrendsView";

export const dynamic = "force-dynamic";

export default async function TrendsPage() {
  const { rows, sessions } = await getTrendsData();
  return (
    <TrendsView
      rows={rows as unknown as TrendRow[]}
      sessions={sessions as unknown as TrendSession[]}
    />
  );
}
