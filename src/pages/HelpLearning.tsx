import { Link, useParams } from "react-router-dom";
import { useMemo, useState } from "react";
import { BookOpen, CircleHelp, FileText, GraduationCap, PlayCircle, Search, UsersRound, Video } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TutorialDetail } from "@/components/help/TutorialDetail";
import { allTutorials, gettingStartedTutorials, tutorialCategories, videoTutorials, type TutorialCategory } from "@/data/helpLearningContent";

const supportActions = [
  { title: "Ask for Analysis Support", description: "Get help with a VivaSense workflow or result screen.", icon: CircleHelp },
  { title: "Request a Live Support Session", description: "Ask the team about arranging a live support conversation.", icon: UsersRound },
  { title: "Dataset / Design Guidance", description: "Request guidance before you begin an analysis.", icon: FileText },
];

export default function HelpLearning() {
  const { tutorialSlug } = useParams();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<TutorialCategory | "All">("All");
  const tutorial = tutorialSlug ? allTutorials.find((item) => item.slug === tutorialSlug) : undefined;

  const filteredTutorials = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return allTutorials.filter((item) => {
      const categoryMatches = category === "All" || item.category === category;
      const text = [item.title, item.description, item.category, ...item.keywords].join(" ").toLocaleLowerCase();
      return categoryMatches && (!normalized || text.includes(normalized));
    });
  }, [category, query]);

  if (tutorialSlug && tutorial) {
    const video = videoTutorials.find((item) => item.category === tutorial.category);
    return <Layout showFooter><TutorialDetail tutorial={tutorial} video={video} /></Layout>;
  }

  if (tutorialSlug) {
    return (
      <Layout showFooter>
        <main className="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col items-start justify-center px-4 py-12 sm:px-6">
          <h1 className="text-3xl font-semibold">Tutorial not found</h1>
          <p className="mt-2 text-muted-foreground">The tutorial you requested is not available in this Help & Learning release.</p>
          <Button asChild className="mt-6"><Link to="/help">Browse Help & Learning</Link></Button>
        </main>
      </Layout>
    );
  }

  return (
    <Layout showFooter>
      <main>
        <section className="border-b border-border bg-primary-soft/35">
          <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
            <Badge variant="secondary" className="bg-background/80">VivaSense Learning Centre</Badge>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">Help &amp; Learning</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
              Learn how to prepare your data, understand experimental designs, run analyses correctly, interpret VivaSense results, and get help when you need it.
            </p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:py-14" aria-labelledby="getting-started">
          <SectionHeading icon={GraduationCap} title="Getting Started" description="Follow the VivaSense research workflow from dataset preparation to report export." />
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {gettingStartedTutorials.map((item) => <TutorialCard key={item.slug} tutorial={item} />)}
          </div>
        </section>

        <section className="border-y border-border bg-muted/35" aria-labelledby="analysis-tutorials">
          <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
            <SectionHeading icon={BookOpen} title="Analysis Tutorials" description="Browse tutorials for analysis options currently represented in the VivaSense interface." />
            <div className="mt-6 max-w-2xl">
              <label htmlFor="tutorial-search" className="sr-only">Search tutorials</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input id="tutorial-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tutorials by title, category, or keyword" className="pl-9" />
              </div>
            </div>
            <Tabs value={category} onValueChange={(value) => setCategory(value as TutorialCategory | "All")} className="mt-5">
              <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto bg-transparent p-0" aria-label="Filter tutorials by category">
                <TabsTrigger value="All" className="shrink-0 border border-border bg-background data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">All</TabsTrigger>
                {tutorialCategories.map((item) => <TabsTrigger key={item} value={item} className="shrink-0 border border-border bg-background data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">{item}</TabsTrigger>)}
              </TabsList>
            </Tabs>
            <p className="mt-5 text-sm text-muted-foreground" role="status">{filteredTutorials.length} tutorial{filteredTutorials.length === 1 ? "" : "s"} found</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTutorials.map((item) => <TutorialCard key={item.slug} tutorial={item} />)}
            </div>
            {filteredTutorials.length === 0 && <p className="mt-6 rounded-lg border border-dashed border-border bg-background p-6 text-sm text-muted-foreground">No tutorials match that search. Try a broader title, category, or keyword.</p>}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:py-14" aria-labelledby="video-tutorials">
          <SectionHeading icon={Video} title="Video Tutorials" description="Short VivaSense walkthroughs will appear here as approved recordings are supplied." />
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {videoTutorials.map((video) => (
              <Card key={video.title} className="overflow-hidden">
                <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-primary/15 to-primary-soft">
                  <PlayCircle className="h-12 w-12 text-primary" aria-hidden="true" />
                </div>
                <CardHeader className="p-5 pb-2"><div className="flex items-center justify-between gap-3"><Badge variant="secondary">{video.category}</Badge><span className="text-xs text-muted-foreground">{video.duration}</span></div><CardTitle className="text-lg">{video.title}</CardTitle></CardHeader>
                <CardContent className="p-5 pt-0"><CardDescription>{video.description}</CardDescription><Button disabled className="mt-4 w-full" variant="outline">Video coming soon</Button></CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="border-t border-border bg-primary-soft/30" aria-labelledby="research-support">
          <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
            <SectionHeading icon={CircleHelp} title="Need help with your real data?" description="If a tutorial does not resolve your question, Research Support can help you decide what to do next." />
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {supportActions.map((action) => {
                const Icon = action.icon;
                return <Card key={action.title}><CardContent className="p-5"><Icon className="h-6 w-6 text-primary" aria-hidden="true" /><h3 className="mt-3 font-semibold">{action.title}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{action.description}</p><Button disabled className="mt-5 w-full">Support contact coming soon</Button></CardContent></Card>;
              })}
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}

function SectionHeading({ icon: Icon, title, description }: { icon: typeof BookOpen; title: string; description: string }) {
  return <div><div className="flex items-center gap-2 text-primary"><Icon className="h-5 w-5" aria-hidden="true" /><span className="text-sm font-semibold uppercase tracking-wide">VivaSense Help</span></div><h2 id={title.toLocaleLowerCase().replaceAll(" ", "-")} className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2><p className="mt-2 max-w-3xl text-muted-foreground">{description}</p></div>;
}

function TutorialCard({ tutorial }: { tutorial: (typeof allTutorials)[number] }) {
  return <Card className="flex h-full flex-col transition-shadow hover:shadow-md">
    <CardHeader className="p-5 pb-2"><div className="flex items-start justify-between gap-2"><Badge variant="secondary" className="max-w-[75%] whitespace-normal text-left">{tutorial.category}</Badge>{tutorial.status === "under-review" && <span className="text-xs text-muted-foreground">Under review</span>}</div><CardTitle className="mt-3 text-lg">{tutorial.title}</CardTitle></CardHeader>
    <CardContent className="flex flex-1 flex-col p-5 pt-0"><CardDescription className="leading-6">{tutorial.description}</CardDescription><Button asChild variant="link" className="mt-4 h-auto justify-start self-start px-0"><Link to={`/help/${tutorial.slug}`}>Open tutorial</Link></Button></CardContent>
  </Card>;
}
