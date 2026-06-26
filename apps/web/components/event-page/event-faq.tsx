import { HelpCircle } from "lucide-react";

type FAQItem = { question: string; answer: string };

export function EventFaq({ faqJson }: { faqJson?: any }) {
  const faqs = (faqJson as FAQItem[]) || [];

  if (faqs.length === 0) return null;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">Perguntas Frequentes</h2>
      <div className="space-y-4">
        {faqs.map((faq, i) => (
          <details 
            key={i} 
            className="group rounded-xl border bg-card p-6 shadow-sm transition-all open:ring-1 open:ring-primary/20"
          >
            <summary className="flex cursor-pointer items-center justify-between font-medium text-foreground outline-none marker:content-none">
              <span className="flex items-center gap-3">
                <HelpCircle className="h-5 w-5 text-primary/70" />
                {faq.question}
              </span>
              <span className="transition-transform duration-300 group-open:rotate-180">
                <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </summary>
            <div className="mt-4 pl-8 text-muted-foreground leading-relaxed animate-in fade-in slide-in-from-top-2">
              {faq.answer}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
