import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Download, Info, Mail, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Tutorial } from "@/data/helpLearningContent";

interface TutorialDetailProps {
  tutorial: Tutorial;
}

export function TutorialDetail({ tutorial }: TutorialDetailProps) {
  return (
    <article className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:py-12">
      <Button asChild variant="ghost" size="sm" className="mb-5 -ml-3 text-muted-foreground">
        <Link to="/help"><ArrowLeft aria-hidden="true" />Back to Help & Learning</Link>
      </Button>

      <header className="border-b border-border pb-8">
        <Badge variant="secondary">{tutorial.category}</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{tutorial.title}</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">{tutorial.description}</p>
        {tutorial.actionPath && tutorial.actionLabel && (
          <Button asChild className="mt-5">
            <Link to={tutorial.actionPath}>
              {tutorial.actionLabel} <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        )}
        {tutorial.actionHref && tutorial.actionLabel && (
          <Button asChild className="mt-5">
            <a href={tutorial.actionHref}>
              <Mail className="mr-1 h-4 w-4" aria-hidden="true" /> {tutorial.actionLabel}
            </a>
          </Button>
        )}
      </header>

      <div className="mt-8 space-y-8">
        {tutorial.sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-xl font-semibold">{section.title}</h2>

            {section.paragraphs?.map((paragraph) => (
              <p key={paragraph} className="mt-3 leading-7 text-muted-foreground">{paragraph}</p>
            ))}

            {section.bullets && (
              <ul className="mt-3 list-disc space-y-2 pl-6 leading-7 text-muted-foreground">
                {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
              </ul>
            )}

            {section.example && (
              <Card className="mt-4 bg-muted/35">
                <CardContent className="p-4 sm:p-5">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Info className="h-4 w-4 text-primary" aria-hidden="true" />
                    Example dataset shape
                  </div>
                  <pre className="max-w-full overflow-x-auto rounded-md border border-border bg-background p-3 text-xs leading-6 text-foreground">
                    {section.example.join("\n")}
                  </pre>
                </CardContent>
              </Card>
            )}

            {section.resources && (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {section.resources.map((resource) => (
                  <a
                    key={resource.href}
                    href={resource.href}
                    download={resource.download || undefined}
                    className="min-w-0 rounded-md border border-border bg-background p-3 transition-colors hover:border-primary/50 hover:bg-primary-soft/30"
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-primary">
                      {resource.download ? <Download className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                      {resource.label}
                    </span>
                    {resource.description && (
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">{resource.description}</span>
                    )}
                  </a>
                ))}
              </div>
            )}

            {section.note && (
              <div className="mt-4 flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm leading-6 text-amber-950 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <p>{section.note}</p>
              </div>
            )}
          </section>
        ))}

        <Card className="border-primary/25 bg-primary-soft/40">
          <CardContent className="p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Early Access reminder</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              If the data structure does not match the experiment, correct the dataset or design choice before analysis.
              Do not force a model simply to obtain an output. For Preview designs, download the Word report before leaving the session.
            </p>
          </CardContent>
        </Card>
      </div>
    </article>
  );
}
