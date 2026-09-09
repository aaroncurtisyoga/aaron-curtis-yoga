import { getTrainingHome } from "@/app/_lib/actions/training.actions";
import TrainHome from "./_components/TrainHome";
import type {
  PlannedSessionDto,
  SessionWithMovementsDto,
} from "./_components/types";

export const dynamic = "force-dynamic";

export default async function TrainPage() {
  const { todaySessions, recentSessions, todayPlans } = await getTrainingHome();
  return (
    <TrainHome
      todaySessions={todaySessions as unknown as SessionWithMovementsDto[]}
      recentSessions={recentSessions as unknown as SessionWithMovementsDto[]}
      todayPlans={todayPlans as unknown as PlannedSessionDto[]}
    />
  );
}
