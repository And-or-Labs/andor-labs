import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@andor/ds";

export function Faq({ items }: { items: readonly (readonly [string, string])[] }) {
  return (
    <Accordion type="single" collapsible defaultValue="q0" className="border-t">
      {items.map(([q, a], i) => (
        <AccordionItem key={q} value={`q${i}`}>
          <AccordionTrigger>{q}</AccordionTrigger>
          <AccordionContent>{a}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
