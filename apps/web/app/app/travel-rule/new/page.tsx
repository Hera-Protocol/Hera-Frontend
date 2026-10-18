"use client";

import { Suspense } from "react";
import { TravelRuleWizard } from "@/components/travel-rule/wizard";
import { LoadingBlock } from "@/components/ui/misc";

export default function NewTravelRulePage() {
  // useSearchParams (for ?beneficiary=) needs a Suspense boundary.
  return (
    <Suspense fallback={<LoadingBlock rows={6} />}>
      <TravelRuleWizard />
    </Suspense>
  );
}
