import type { LucideIcon } from "lucide-react";

type StepItem = { title: string; icon: LucideIcon };

export function StepNavigation({ steps, currentStep, onStepChange }: {
  steps: readonly StepItem[];
  currentStep: number;
  onStepChange: (step: number) => void;
}) {
  return (
    <nav aria-label="Etapas de criação do evento" className="grid grid-cols-3 gap-2 rounded-lg border bg-card p-1">
      {steps.map((item, index) => {
        const Icon = item.icon;
        const active = currentStep === index;
        return (
          <button
            key={item.title}
            type="button"
            aria-current={active ? "step" : undefined}
            aria-label={`${item.title}, etapa ${index + 1} de ${steps.length}${active ? ", atual" : ""}`}
            onClick={() => onStepChange(index)}
            className={`flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-xs font-medium transition-colors ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{item.title}</span>
          </button>
        );
      })}
    </nav>
  );
}
