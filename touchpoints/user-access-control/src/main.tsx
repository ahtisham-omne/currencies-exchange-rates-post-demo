import { createRoot } from "react-dom/client";
import { applyOnboardingHandoff } from "./app/data/onboarding-handoff";
import "./index.css";

/* What Omne Home's onboarding set up lands before anything renders (see
 * onboarding-handoff.ts): its people join the users list, or, when it carries
 * the company, UAC opens as that company. The app itself loads only after, so
 * the lists some modules take once as they load (the Assign Roles step's
 * roles, for one) are taken from what the hand-off left, not the sample. */
applyOnboardingHandoff();

void import("./app/App.tsx").then(({ default: App }) => {
  createRoot(document.getElementById("root")!).render(<App />);
});
