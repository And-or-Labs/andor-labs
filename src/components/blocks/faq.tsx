import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

const categories = [
  {
    title: "Fractional GTM",
    questions: [
      {
        question: "How is this different from a typical marketing agency?",
        answer:
          "Agencies staff you with a junior account team and run the same playbook. Here you work directly with an operator who led marketing and sales ops at two adtech startups through their acquisitions. The work spans the whole GTM rather than one slice of it.",
      },
      {
        question: "Who will I actually be working with?",
        answer:
          "The founder, directly. No account layers and no handoff once the pitch is over.",
      },
      {
        question: "Do you only work with early-stage startups?",
        answer:
          "The operator track record was earned in adtech: a technically literate buyer, hard to impress, quick to spot a bluff. That transfers to most technical categories. Book a call and you will get an honest read on fit before anyone signs anything.",
      },
    ],
  },
  {
    title: "MediaContext",
    questions: [
      {
        question: "What is MediaContext?",
        answer:
          "Market intelligence for the premium open web, built by And/or Labs.",
      },
      {
        question: "How do I get access?",
        answer:
          "It is invite-only. Request access at mediacontext.dev.",
      },
    ],
  },
  {
    title: "Other questions",
    questions: [
      {
        question: "Where do you write?",
        answer:
          "Field notes on this site, plus bylines in ExchangeWire, Forbes Councils and Digital Content Next.",
      },
      {
        question: "Are you going to be subsumed by AI?",
        answer:
          "We are an applied AI lab, so we would like to think we are doing the subsuming.",
      },
    ],
  },
];

export const FAQ = ({
  headerTag = "h2",
  className,
  className2,
}: {
  headerTag?: "h1" | "h2";
  className?: string;
  className2?: string;
}) => {
  return (
    <section className={cn("py-28 lg:py-32", className)}>
      <div className="container max-w-5xl">
        <div className={cn("mx-auto grid gap-16 lg:grid-cols-2", className2)}>
          <div className="space-y-4">
            {headerTag === "h1" ? (
              <h1 className="text-2xl tracking-tight md:text-4xl lg:text-5xl">
                Got Questions?
              </h1>
            ) : (
              <h2 className="text-2xl tracking-tight md:text-4xl lg:text-5xl">
                Got Questions?
              </h2>
            )}
            <p className="text-muted-foreground max-w-md leading-snug lg:mx-auto">
              If you can't find what you're looking for,{" "}
              <a href="https://cal.com/jatain/book" className="underline underline-offset-4">
                book a call
              </a>
              .
            </p>
          </div>

          <div className="grid gap-6 text-start">
            {categories.map((category, categoryIndex) => (
              <div key={category.title} className="">
                <h3 className="text-muted-foreground border-b py-4">
                  {category.title}
                </h3>
                <Accordion type="single" collapsible className="w-full">
                  {category.questions.map((item, i) => (
                    <AccordionItem key={i} value={`${categoryIndex}-${i}`}>
                      <AccordionTrigger>{item.question}</AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        {item.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
