"use client";

import type { CreateTravelRuleInput } from "@hera/core";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { type FieldErrors, FormProvider, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Button, ButtonLink } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { PageHeader, Segmented } from "@/components/ui/misc";
import { ApiError, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useUnsavedChangesPrompt } from "@/lib/hooks/compliance";
import { useCreateTravelRule } from "@/lib/queries";
import { AccountsStep } from "./accounts-step";
import { AmountStep } from "./amount-step";
import type { FormPath } from "./fields";
import {
  defaultValues,
  detectChain,
  IDENTIFIER_MESSAGE,
  liveCheck,
  STEPS,
  stepForPath,
  type StepFields,
  travelRuleResolver,
  type TravelRuleFormValues,
  type VaspForm,
} from "./form";
import { LiveCheckPanel } from "./live-check";
import { PersonFieldset } from "./person-fieldset";
import { ReviewStep } from "./review-step";
import { Stepper } from "./stepper";

const TITLES = ["Parties", "Accounts", "Amount and jurisdiction", "Review"];
const NEXT = ["Continue to accounts", "Continue to amount", "Review transfer", "Create transfer"];
const LAST = STEPS.length - 1;

export function TravelRuleWizard() {
  const router = useRouter();
  const params = useSearchParams();
  const [initial] = useState(() => defaultValues(params.get("beneficiary")?.trim() ?? ""));
  const methods = useForm<TravelRuleFormValues, unknown, CreateTravelRuleInput>({
    resolver: travelRuleResolver,
    defaultValues: initial,
    mode: "onTouched",
  });
  const { control, formState, getValues, setValue, getFieldState, trigger, setError, handleSubmit } = methods;
  const create = useCreateTravelRule();

  const [step, setStep] = useState(0);
  const [identifierError, setIdentifierError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const savedVasp = useRef<VaspForm | null>(null);
  const usdTouched = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);

  const values = useWatch({ control }) as TravelRuleFormValues;
  const { hasIdentifier } = liveCheck(values);

  useUnsavedChangesPrompt(formState.isDirty && !done, "Leave this transfer? What you've entered will be lost.");

  // Follow the accounts' chain until the user picks one.
  const [originAddress, beneficiaryAddress] = [values.originatorAccount.address, values.beneficiaryAccount.address];
  useEffect(() => {
    if (getFieldState("chain").isDirty) return;
    const detected = detectChain(originAddress) ?? detectChain(beneficiaryAddress);
    if (detected && detected !== getValues("chain")) setValue("chain", detected);
  }, [originAddress, beneficiaryAddress, getFieldState, getValues, setValue]);

  // Move focus to the step heading so keyboard and screen reader users land in the new step.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const goTo = async (target: number) => {
    if (target <= step) return setStep(target);
    for (let s = step; s < target; s++) {
      const ok = await trigger([...STEPS[s]!.fields] as StepFields[], { shouldFocus: true });
      if (!ok) return setStep(s);
    }
    setStep(target);
  };

  const onValid = async (data: CreateTravelRuleInput) => {
    setRequestError(null);
    const { check, hasIdentifier: ok } = liveCheck(getValues());
    if (check.required && !ok) {
      setIdentifierError(IDENTIFIER_MESSAGE);
      setStep(0);
      return;
    }
    try {
      const transfer = await create.mutateAsync(data);
      setDone(true);
      toast.success(`Transfer ${transfer.reference} created`, { description: "Saved as a draft with its rule check." });
      router.push(`/app/travel-rule/${transfer.id}`);
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fields).length > 0) {
        let first = LAST;
        for (const [path, message] of Object.entries(error.fields)) {
          if (path === "originator") setIdentifierError(message);
          else setError(path as FormPath, { type: "server", message });
          first = Math.min(first, path === "originator" ? 0 : stepForPath(path));
        }
        setStep(first);
        setRequestError(first === LAST ? error.message : "Some details need fixing. They're highlighted below.");
      } else {
        setRequestError(errorMessage(error));
      }
    }
  };

  const onInvalid = (errors: FieldErrors<TravelRuleFormValues>) => {
    const steps = Object.keys(errors).map(stepForPath);
    if (steps.length) setStep(Math.min(...steps));
  };

  const direction = values.direction;

  return (
    <div className="flex flex-col gap-[22px]">
      <PageHeader
        title="New Travel Rule transfer"
        description="IVMS101 data for both parties, checked against the jurisdiction's threshold before anything is sent."
        actions={<Stepper steps={STEPS} current={step} onSelect={(i) => void goTo(i)} />}
      />

      <div className="flex flex-wrap items-start gap-[22px]">
        <FormProvider {...methods}>
          <form
            noValidate
            aria-label="New Travel Rule transfer"
            className="flex min-w-0 flex-[999_1_560px] flex-col gap-5"
            onSubmit={(e) => {
              if (step < LAST) {
                e.preventDefault();
                void goTo(step + 1);
              } else {
                void handleSubmit(onValid, onInvalid)(e);
              }
            }}
          >
            <section
              aria-labelledby="tr-step-title"
              className={cn(
                "flex flex-col gap-4 rounded-[16px] bg-card p-5",
                step === 2 ? "border-3 border-line shadow-[6px_6px_0_var(--iris)]" : "border-2 border-line shadow-hard",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="tr-step-title" ref={headingRef} tabIndex={-1} className="text-[22px] font-extrabold outline-none">
                  <span className="sr-only">
                    Step {step + 1} of {STEPS.length}:{" "}
                  </span>
                  {TITLES[step]}
                </h2>
                {step === 0 && (
                  <Segmented
                    label="Direction"
                    value={direction}
                    onChange={(v) => setValue("direction", v, { shouldDirty: true })}
                    options={[
                      { value: "outgoing", label: "Outgoing" },
                      { value: "incoming", label: "Incoming" },
                    ]}
                  />
                )}
              </div>

              {step === 0 && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <PersonFieldset
                    role="originator"
                    ours={direction === "outgoing"}
                    identifierError={identifierError && !hasIdentifier ? identifierError : null}
                  />
                  <PersonFieldset role="beneficiary" ours={direction === "incoming"} />
                </div>
              )}
              {step === 1 && <AccountsStep savedVasp={savedVasp} />}
              {step === 2 && <AmountStep usdTouched={usdTouched} />}
              {step === 3 && <ReviewStep values={values} onEdit={(s) => setStep(s)} />}
            </section>

            <FormError message={requestError} />

            <div className="flex flex-wrap justify-between gap-3">
              {step === 0 ? (
                <ButtonLink href="/app/travel-rule" variant="secondary">
                  Cancel
                </ButtonLink>
              ) : (
                <Button variant="secondary" onClick={() => setStep(step - 1)}>
                  <ArrowLeft aria-hidden className="size-4" /> Back
                </Button>
              )}
              <Button type="submit" loading={create.isPending} variant={step === LAST ? "ink" : "primary"}>
                {NEXT[step]}
                {step < LAST && <ArrowRight aria-hidden className="size-4" />}
              </Button>
            </div>
          </form>
        </FormProvider>

        <aside aria-label="Rule check" className="flex min-w-0 flex-[1_1_340px] flex-col gap-5 lg:sticky lg:top-24">
          <LiveCheckPanel values={values} />
        </aside>
      </div>
    </div>
  );
}
