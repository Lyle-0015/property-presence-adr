import { strict as assert } from "node:assert";
import { chooseInspectionReminders } from "./presence_decision.ts";

const reminders = chooseInspectionReminders(
  [{ title: "Lift inspection", inspectionDate: "2026-10-24" }, { title: "Roof review", inspectionDate: "2026-11-01" }],
  "2026-10-24",
);
assert.deepEqual(reminders, ["Lift inspection"]);
console.log("inspection reminder decision: passed");
