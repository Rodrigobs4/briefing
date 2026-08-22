export type UnitUpdateAlertStatus = "overdue" | "late" | "pending" | "complete";

export interface UnitUpdateAlertRuleLike {
  startsAt: string;
  weekdays: number[];
  deadlineTime: string;
}

export interface UnitUpdateAlertEvaluation {
  status: UnitUpdateAlertStatus;
  dueAt: Date;
  cycleStart: Date;
  latestUpdate: string | null;
}

const parseDeadlineTime = (deadlineTime: string) => {
  const [hours = 18, minutes = 0] = deadlineTime.split(":").map(Number);
  return { hours, minutes };
};

export const buildRecurringUpdateDeadlines = (
  rule: UnitUpdateAlertRuleLike,
  now = new Date(),
  dayWindow = 120,
) => {
  const activatedAt = new Date(rule.startsAt);
  const { hours, minutes } = parseDeadlineTime(rule.deadlineTime);
  const deadlines: Date[] = [];

  for (let offset = -dayWindow; offset <= dayWindow; offset += 1) {
    const deadline = new Date(now);
    deadline.setDate(now.getDate() + offset);
    deadline.setHours(hours, minutes, 0, 0);
    if (rule.weekdays.includes(deadline.getDay()) && deadline.getTime() >= activatedAt.getTime()) {
      deadlines.push(deadline);
    }
  }

  deadlines.sort((left, right) => left.getTime() - right.getTime());
  return { activatedAt, deadlines };
};

const getCycleStart = (deadlines: Date[], deadline: Date, activatedAt: Date) => {
  const index = deadlines.findIndex((candidate) => candidate.getTime() === deadline.getTime());
  if (index <= 0) return activatedAt;
  return deadlines[index - 1];
};

const getLatestUpdateInWindow = (updateTimestamps: string[], cycleStart: Date, cycleEnd: Date) => {
  const windowStart = cycleStart.getTime();
  const windowEnd = cycleEnd.getTime();
  const latest = updateTimestamps
    .map((updatedAt) => new Date(updatedAt))
    .filter((updatedAt) => {
      const timestamp = updatedAt.getTime();
      return timestamp > windowStart && timestamp <= windowEnd;
    })
    .sort((left, right) => right.getTime() - left.getTime())[0];

  return latest ? latest.toISOString() : null;
};

const getLatestUpdateAfter = (updateTimestamps: string[], cycleStart: Date) => {
  const windowStart = cycleStart.getTime();
  const latest = updateTimestamps
    .map((updatedAt) => new Date(updatedAt))
    .filter((updatedAt) => updatedAt.getTime() > windowStart)
    .sort((left, right) => right.getTime() - left.getTime())[0];

  return latest ? latest.toISOString() : null;
};

const evaluatePassedDeadline = (
  updateTimestamps: string[],
  deadlines: Date[],
  dueAt: Date,
  activatedAt: Date,
): Pick<UnitUpdateAlertEvaluation, "status" | "cycleStart" | "latestUpdate"> => {
  const cycleStart = getCycleStart(deadlines, dueAt, activatedAt);
  const latestUpdate = getLatestUpdateInWindow(updateTimestamps, cycleStart, dueAt);

  if (latestUpdate) {
    return { status: "complete", cycleStart, latestUpdate };
  }

  const latestAfterCycleStart = getLatestUpdateAfter(updateTimestamps, cycleStart);
  if (latestAfterCycleStart && new Date(latestAfterCycleStart).getTime() > dueAt.getTime()) {
    return { status: "late", cycleStart, latestUpdate: latestAfterCycleStart };
  }

  return { status: "overdue", cycleStart, latestUpdate: latestAfterCycleStart };
};

export const evaluateUnitUpdateAlert = (
  rule: UnitUpdateAlertRuleLike,
  updateTimestamps: string[],
  now = new Date(),
): UnitUpdateAlertEvaluation => {
  const { activatedAt, deadlines } = buildRecurringUpdateDeadlines(rule, now);

  if (deadlines.length === 0) {
    return {
      status: "pending",
      dueAt: activatedAt,
      cycleStart: activatedAt,
      latestUpdate: null,
    };
  }

  const passedDeadlines = deadlines.filter((deadline) => deadline.getTime() <= now.getTime());
  const upcomingDeadline = deadlines.find((deadline) => deadline.getTime() > now.getTime()) ?? null;
  const lastPassedDeadline = passedDeadlines[passedDeadlines.length - 1] ?? null;

  if (upcomingDeadline && now.getTime() < upcomingDeadline.getTime()) {
    const openCycleStart = getCycleStart(deadlines, upcomingDeadline, activatedAt);
    const openCycleUpdate = getLatestUpdateInWindow(updateTimestamps, openCycleStart, upcomingDeadline);

    if (openCycleUpdate) {
      return {
        status: "complete",
        dueAt: upcomingDeadline,
        cycleStart: openCycleStart,
        latestUpdate: openCycleUpdate,
      };
    }

    if (lastPassedDeadline) {
      const lastCycleResult = evaluatePassedDeadline(
        updateTimestamps,
        deadlines,
        lastPassedDeadline,
        activatedAt,
      );

      if (lastCycleResult.status === "complete") {
        return {
          status: "complete",
          dueAt: upcomingDeadline,
          cycleStart: lastCycleResult.cycleStart,
          latestUpdate: lastCycleResult.latestUpdate,
        };
      }

      if (now.getTime() > lastPassedDeadline.getTime()) {
        return {
          status: lastCycleResult.status,
          dueAt: lastPassedDeadline,
          cycleStart: lastCycleResult.cycleStart,
          latestUpdate: lastCycleResult.latestUpdate,
        };
      }
    }

    return {
      status: "pending",
      dueAt: upcomingDeadline,
      cycleStart: openCycleStart,
      latestUpdate: null,
    };
  }

  if (lastPassedDeadline) {
    const result = evaluatePassedDeadline(updateTimestamps, deadlines, lastPassedDeadline, activatedAt);
    return {
      ...result,
      dueAt: lastPassedDeadline,
    };
  }

  const firstDeadline = deadlines[0];
  return {
    status: "pending",
    dueAt: firstDeadline,
    cycleStart: getCycleStart(deadlines, firstDeadline, activatedAt),
    latestUpdate: null,
  };
};
