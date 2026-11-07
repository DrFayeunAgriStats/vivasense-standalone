import { useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { allTutorials, type TutorialSection } from "@/data/helpLearningContent";

const correlationGuide: { slug: string; sections: TutorialSection[] } = {
  slug: "general-correlation",
  sections: [{
    title: "Run General Correlation",
    bullets: [
      "Open General Correlation in the workspace sidebar.",
      "Upload or select your dataset, then choose at least two numeric variables to compare.",
      "Choose Pearson for a linear relationship or Spearman for a rank-based monotonic relationship.",
      "Select the significance level and run the analysis. Use the download option on the results screen to save the Word report.",
    ],
    note: "Use one row per independent observational unit. For breeding questions about genetic correlations, use the dedicated breeding workflow rather than General Correlation.",
  }],
};

const topics = [
  { label: "Generate a field layout", slug: "field-layout", match: /\b(field[- ]?(?:layout|book|map)|plot[- ]layout|randomi[sz]ation seed)\b/i },
  { label: "Run General Correlation", slug: correlationGuide.slug, match: /\b(correlat\w*|pearson|spearman)\b/i },
  { label: "Prepare or upload data", slug: "prepare-dataset", match: /\b(upload|csv|xlsx?|excel|format|columns?|missing)\b/i },
  { label: "Map a split-plot design", slug: "split-plot-rcbd", match: /\b(split[- ]plot|whole[- ]plot|sub[- ]?plot)\b/i },
  { label: "Choose a design", slug: "choose-design", match: /\b(design|randomi[sz]\w*|map|mapping|treatments?|factorial|r?cbd|crd)\b/i },
  { label: "Run an analysis", slug: "run-analysis", match: /\b(run|anova|error|failed|stuck)\b/i },
  { label: "Download or reopen a report", slug: "reports-and-saved-analyses", match: /\b(report|download|word|reopen|saved|preview)\b/i },
];

export function AskVivaSense() {
  const { pathname, search } = useLocation();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState<{ prompt: string; slug?: string }>();
  const module = new URLSearchParams(search).get("module");
  const contextualSlug = pathname === "/data-capture"
    ? "data-capture"
    : module === "field-layout" ? "field-layout" : undefined;
  const tutorial = reply?.slug === correlationGuide.slug
    ? correlationGuide
    : allTutorials.find((item) => item.slug === reply?.slug);
  const sections = tutorial?.slug === "split-plot-rcbd"
    ? tutorial.sections.slice(0, 2)
    : (tutorial?.slug === "reports-and-saved-analyses" || tutorial?.slug === "field-layout")
      ? tutorial.sections
      : tutorial ? [tutorial.sections.find((item) => item.bullets?.length) ?? tutorial.sections[0]].filter(Boolean) : [];

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = question.trim();
    if (!prompt) return;
    const topic = [...topics].reverse().find((item) => item.match.test(prompt));
    const directTopic = topics.find((item) => (item.slug === correlationGuide.slug || item.slug === "split-plot-rcbd" || item.slug === "field-layout") && item.match.test(prompt));
    setReply({ prompt, slug: directTopic?.slug ?? topic?.slug });
    setQuestion("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="fixed bottom-16 right-4 z-40 shadow-md sm:bottom-4">Ask VivaSense</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ask VivaSense</DialogTitle>
          <DialogDescription>
            Get quick answers from Help &amp; Learning. Please keep dataset values out of your question.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {topics.map(({ label, slug }) => (
            <Button key={slug} size="sm" variant="outline" onClick={() => setReply({ prompt: label, slug })}>
              {label}
            </Button>
          ))}
          {contextualSlug && (
            <Button size="sm" variant="outline" onClick={() => setReply({ prompt: "Help with this screen", slug: contextualSlug })}>
              Help with this screen
            </Button>
          )}
        </div>
        <div aria-live="polite" className="space-y-2 text-sm">
          {reply && <p className="break-words font-semibold">{reply.prompt}</p>}
          {tutorial && sections.length ? (
            <>
              {sections.map((section) => <div className="space-y-2" key={section.title}>
              <p className="font-medium">{section.title}</p>
              {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {section.bullets && (
                <ul className="list-disc space-y-1 pl-5">
                  {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                </ul>
              )}
              {section.note && <p>{section.note}</p>}
              </div>)}
              {tutorial.slug === "field-layout" && (
                <Link className="underline" to="/workspace?module=field-layout" onClick={() => setOpen(false)}>
                  Open Field Layout
                </Link>
              )}
              {tutorial.slug !== correlationGuide.slug && (
                <Link className="underline" to={`/help/${tutorial.slug}`} onClick={() => setOpen(false)}>
                  Read the full guide
                </Link>
              )}
            </>
          ) : reply ? (
            <p>Try a topic above or browse Help &amp; Learning for more guidance.</p>
          ) : null}
        </div>
        <form onSubmit={submit} className="flex gap-2">
          <input
            aria-label="Your support question"
            className="min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
            maxLength={240}
            placeholder="Type a support question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
          />
          <Button type="submit" disabled={!question.trim()}>Ask</Button>
        </form>
        <div className="flex flex-wrap gap-4 text-sm">
          <Link className="underline" to="/help" onClick={() => setOpen(false)}>Help &amp; Learning</Link>
          <a className="underline" href="mailto:support@vivasensestat.com">Email support</a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
