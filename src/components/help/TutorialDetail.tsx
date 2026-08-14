import { Link } from "react-router-dom";
import { ArrowLeft, CircleHelp, ExternalLink, PlayCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Tutorial, VideoTutorial } from "@/data/helpLearningContent";

interface TutorialDetailProps {
  tutorial: Tutorial;
  video?: VideoTutorial;
}

const underReview = "Tutorial content under scientific review.";

export function TutorialDetail({ tutorial, video }: TutorialDetailProps) {
  return (
    <article className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:py-12">
      <Button asChild variant="ghost" size="sm" className="mb-5 -ml-3 text-muted-foreground">
        <Link to="/help"><ArrowLeft aria-hidden="true" />Back to Help & Learning</Link>
      </Button>

      <header className="border-b border-border pb-8">
        <Badge variant="secondary">{tutorial.category}</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{tutorial.title}</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">{tutorial.description}</p>
      </header>

      <div className="mt-8 space-y-5">
        <TutorialSection title="What is it?" />
        <TutorialSection title="When should I use it?" />
        <TutorialSection title="What should my data look like?" />
        <TutorialSection title="Before you analyse" />
        <TutorialSection title="How to run it in VivaSense" />
        <TutorialSection title="Understanding the output" />
        <TutorialSection title="Common mistakes" />

        <Card>
          <CardContent className="p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold"><PlayCircle className="h-5 w-5 text-primary" aria-hidden="true" />Video tutorial</h2>
            {video?.url ? (
              <Button asChild className="mt-3"><a href={video.url} target="_blank" rel="noreferrer">Watch video <ExternalLink aria-hidden="true" /></a></Button>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">A video tutorial will be added here when an approved recording is available.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Practice dataset</h2>
            <p className="mt-2 text-sm text-muted-foreground">Canonical practice datasets will be added here after scientific review.</p>
          </CardContent>
        </Card>

        <Card className="border-primary/25 bg-primary-soft/40">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold"><CircleHelp className="h-5 w-5 text-primary" aria-hidden="true" />Need more help?</h2>
              <p className="mt-1 text-sm text-muted-foreground">Research Support can help with questions that tutorials do not resolve.</p>
            </div>
            <Button disabled variant="outline">Support contact coming soon</Button>
          </CardContent>
        </Card>
      </div>
    </article>
  );

  function TutorialSection({ title }: { title: string }) {
    return (
      <section aria-labelledby={`section-${title.replaceAll(" ", "-").toLowerCase()}`}>
        <h2 id={`section-${title.replaceAll(" ", "-").toLowerCase()}`} className="text-xl font-semibold">{title}</h2>
        <p className="mt-2 leading-7 text-muted-foreground">{underReview}</p>
      </section>
    );
  }
}
