import ashbyPreferences from "./ashby/application_preferences_schema.json" with { type: "json" };
import greenhousePreferences from "./greenhouse/application_preferences_schema.json" with { type: "json" };
import leverPreferences from "./lever/application_preferences_schema.json" with { type: "json" };
import smartRecruitersPreferences from "./smart-recruiters/application_preferences_schema.json" with { type: "json" };
import workdayPreferences from "./workday/application_preferences_schema.json" with { type: "json" };

export const applicationPreferenceSchemas = {
  ashby: { label: "Ashby", schema: ashbyPreferences },
  greenhouse: { label: "Greenhouse", schema: greenhousePreferences },
  lever: { label: "Lever", schema: leverPreferences },
  "smart-recruiters": {
    label: "SmartRecruiters",
    schema: smartRecruitersPreferences,
  },
  workday: { label: "Workday", schema: workdayPreferences },
};

import type { JobSiteAdapter } from "../types.ts";
import greenhouse from "./greenhouse/index.ts";
import rippling from "./rippling/index.ts";
import lever from "./lever/index.ts";
import workday from "./workday/index.ts";
import ashby from "./ashby/index.ts";
import smartRecruiters from "./smart-recruiters/index.ts";

export const ADAPTERS: Readonly<Record<string, JobSiteAdapter>> = Object.freeze(
  {
    greenhouse,
    lever,
    rippling,
    workday,
    ashby,
    "smart-recruiters": smartRecruiters,
  },
);
