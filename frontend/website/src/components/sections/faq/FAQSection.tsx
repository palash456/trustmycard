import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";
import { faqs } from "@/data/faq";

import FAQItem from "./FAQItem";

export default function FAQSection() {
    return (
        <Section>
            <Container>
                <div className="mx-auto max-w-3xl">
                    <div className="mb-12 text-center">
                        <h2 className="text-4xl font-bold">
                            Frequently Asked Questions
                        </h2>

                        <p className="mt-4 text-neutral-600">
                            Find answers to the most common questions about TrustMyCard.
                        </p>
                    </div>

                    <div className="space-y-4">
                        {faqs.map((faq) => (
                            <FAQItem
                                key={faq.question}
                                question={faq.question}
                                answer={faq.answer}
                            />
                        ))}
                    </div>
                </div>
            </Container>
        </Section>
    );
}
