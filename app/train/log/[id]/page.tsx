import { notFound } from "next/navigation";
import { getLoggerData } from "@/app/_lib/actions/training.actions";
import Logger from "../../_components/Logger";
import type {
  LastSetsMap,
  MovementDto,
  SessionWithMovementsDto,
} from "../../_components/types";

export const dynamic = "force-dynamic";

export default async function LogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getLoggerData(id);
  if (!data) notFound();
  return (
    <Logger
      initial={{
        session: data.session as unknown as SessionWithMovementsDto,
        movements: data.movements as unknown as MovementDto[],
        lastSets: data.lastSets as unknown as LastSetsMap,
      }}
    />
  );
}
