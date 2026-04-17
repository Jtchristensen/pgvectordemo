# Demo Script — Nationwide Code of Conduct

Questions curated for the `Code of Conduct.pdf` knowledge base. Designed to make the "before RAG" vs "after RAG" difference obvious.

## Recommended demo flow

1. **RAG OFF** — Ask: *"Who is Nationwide's CEO?"*
   → LLM will punt with "I don't have current information" or guess wrong.
2. Flip **RAG ON** → ask the same question.
   → Answers "Kirt Walker" with a citation.
3. Go to **Visualization** → the retrieved chunks light up in gold, showing exactly which parts of the 148 chunks were pulled.
4. Follow up with: *"What number do I call to report fraud?"*
   → So specific a wrong answer would be obviously wrong. RAG nails it.

## Killer questions

### Specific facts — the "aha" moments
- What phone number do I call to report fraud at Nationwide? *(expected: 1-800-4RIPOFF, RPTFRAUD@nationwide.com)*
- Who is Nationwide's CEO? *(expected: Kirt Walker)*
- What is the contact info for the Office of Associate Relations? *(expected: OAR@nationwide.com, 1-855-550-0411 Option 3)*
- What does "tipping" mean in Nationwide's insider trading policy?

### Policy questions — shows LLM synthesizing retrieved context
- What is The Nationwide Way?
- Am I allowed to accept gifts from business partners?
- What happens if I violate the Code of Conduct? *(expected mentions: termination, fines, criminal prosecution)*
- Do I need to re-acknowledge the Code every year?

### Scenario-based — the document already frames these as Q&A
- A co-worker keeps asking me to dinner — what should I do?
- My manager told me "I don't care how you do it, just make the numbers happen" — is that okay?
- My industry friends and I meet monthly to exchange gossip about our companies — is that allowed?

## Why these work

- **Specific enough** the base LLM can't bluff them
- **Answers are in the doc** so retrieval will actually find them
- **Spread across sections** (compliance, insider trading, workplace conduct, gifts, reporting) so retrieved chunks come from different parts of the vector space — visible in the scatter plot
