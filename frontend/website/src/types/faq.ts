export interface FAQ {
    question: string;
    answer: string;
}

export interface FAQItemProps extends FAQ {
    defaultOpen?: boolean;
}
