export type UnitUpdateAlertStatus = "overdue" | "pending" | "complete";

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
  lastUpdateAt: string | null;
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

const getUpdateDayStart = (deadline: Date) => {
  const dayStart = new Date(deadline);
  dayStart.setHours(0, 0, 1, 0);
  return dayStart;
};

const getCycleStart = (deadline: Date, activatedAt: Date) => {
  const dayStart = getUpdateDayStart(deadline);
  return dayStart.getTime() < activatedAt.getTime() ? activatedAt : dayStart;
};

const getAbsoluteLatestUpdate = (updateTimestamps: string[]) => {
  const latest = updateTimestamps
    .map((updatedAt) => new Date(updatedAt))
    .sort((left, right) => right.getTime() - left.getTime())[0];

  return latest ? latest.toISOString() : null;
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
  dueAt: Date,
  activatedAt: Date,
): Pick<UnitUpdateAlertEvaluation, "status" | "cycleStart" | "latestUpdate"> => {
  const cycleStart = getCycleStart(dueAt, activatedAt);
  const latestUpdate = getLatestUpdateInWindow(updateTimestamps, cycleStart, dueAt);

  if (latestUpdate) {
    return { status: "complete", cycleStart, latestUpdate };
  }

  return {
    status: "overdue",
    cycleStart,
    latestUpdate: getLatestUpdateAfter(updateTimestamps, cycleStart),
  };
};

export const evaluateUnitUpdateAlert = (
  rule: UnitUpdateAlertRuleLike,
  updateTimestamps: string[],
  now = new Date(),
): UnitUpdateAlertEvaluation => {
  const { activatedAt, deadlines } = buildRecurringUpdateDeadlines(rule, now);
  const lastUpdateAt = getAbsoluteLatestUpdate(updateTimestamps);

  if (deadlines.length === 0) {
    return {
      status: "pending",
      dueAt: activatedAt,
      cycleStart: activatedAt,
      latestUpdate: null,
      lastUpdateAt,
    };
  }

  const passedDeadlines = deadlines.filter((deadline) => deadline.getTime() <= now.getTime());
  const upcomingDeadline = deadlines.find((deadline) => deadline.getTime() > now.getTime()) ?? null;
  const lastPassedDeadline = passedDeadlines[passedDeadlines.length - 1] ?? null;

  if (upcomingDeadline) {
    const openCycleStart = getCycleStart(upcomingDeadline, activatedAt);

    if (now.getTime() >= openCycleStart.getTime() && now.getTime() < upcomingDeadline.getTime()) {
      const openCycleUpdate = getLatestUpdateInWindow(
        updateTimestamps,
        openCycleStart,
        upcomingDeadline,
      );

      if (openCycleUpdate) {
        return {
          status: "complete",
          dueAt: upcomingDeadline,
          cycleStart: openCycleStart,
          latestUpdate: openCycleUpdate,
          lastUpdateAt,
        };
      }

      return {
        status: "pending",
        dueAt: upcomingDeadline,
        cycleStart: openCycleStart,
        latestUpdate: null,
        lastUpdateAt,
      };
    }
  }

  if (lastPassedDeadline) {
    const result = evaluatePassedDeadline(updateTimestamps, lastPassedDeadline, activatedAt);
    return {
      ...result,
      dueAt: lastPassedDeadline,
      lastUpdateAt,
    };
  }

  const firstDeadline = deadlines[0];
  return {
    status: "pending",
    dueAt: firstDeadline,
    cycleStart: getCycleStart(firstDeadline, activatedAt),
    latestUpdate: null,
    lastUpdateAt,
  };
};
