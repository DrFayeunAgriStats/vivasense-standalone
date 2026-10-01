import { Link, useParams } from "react-router-dom";
import { useMemo, useState } from "react";
import { BookOpen, FileSpreadsheet, FlaskConical, GraduationCap, LayoutGrid, Search } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TutorialDetail } from "@/components/help/TutorialDetail";
import {
  allTutorials,
  gettingStartedTutorials,
  tutorialCategories,
  type TutorialCategory
} from "@/data/helpLearningContent";

const quickLinks = [
  {
    title: "Run ANOVA",
    description: "Upload data and choose CRD, RCBD, Factorial, or Split-Plot.",
    to: "/workspace?module=anova",
    icon: FlaskConical
  },
  {
    title: "Generate Field Layout",
    description: "Randomise treatments and export a field book.",
    to: "/workspace?module=field-layout",
    icon: LayoutGrid
  },
  {
    title: "Capture Field Data",
    description: "Create a study and record plot observations.",
    to: "/data-capture",
    icon: FileSpreadsheet
  }
] as const;

export default function HelpLearning() {
  const { tutorialSlug } = useParams();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<TutorialCategory | "All">("All");
  const tutorial = tutorialSlug ? allTutorials.find((item) => item.slug === tutorialSlug) : undefined;

  const filteredTutorials = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return allTutorials.filter((item) => {
      const categoryMatches = category === "All" || item.category === category;
      const text = [item.title, item.description, item.category, ...item.keywords]
        .join(" ")
        .toLocaleLowerCase();
      return categoryMatches && (!normalized || text.includes(normalized));
    });
  }, [category, query]);

  if (tutorialSlug && tutorial) {
    return <Layout showFooter><TutorialDetail tutorial={tutorial} /></Layout>;
  }

  if (tutorialSlug) {
    return (
      <Layout showFooter>
        <main className="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col items-start justify-center px-4 py-12 sm:px-6">
          <h1 className="text-3xl font-semibold">Tutorial not found</h1>
          <p className="mt-2 text-muted-foreground">
            This Help & Learning topic is not part of the current Early Access guide.
          </p>
          <Button asChild className="mt-6"><Link to="/help">Browse Help & Learning</Link></Button>
        </main>
      </Layout>
    );
  }

  return (
    <Layout showFooter>
      <main>
        <section className="border-b border-border bg-primary-soft/35">
          <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:py-12">
            <Badge variant="secondary" className="bg-background/80">VivaSense Early Access Guide</Badge>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
              Help &amp; Learning
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
              Practical guidance for the VivaSense workflows that are available now: experimental design and ANOVA,
              field layout, data capture, reports, and saved RCBD analyses.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {quickLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <Button key={item.title} asChild variant="outline" className="h-auto justify-start bg-background p-4 text-left">
                    <Link to={item.to}>
                      <Icon className="mr-3 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                      <span>
                        <span className="block font-semibold">{item.title}</span>
                        <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{item.description}</span>
                      </span>
                    </Link>
                  </Button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6" aria-labelledby="getting-started">
          <SectionHeading
            icon={GraduationCap}
            title="Start Here"
            description="Use these guides if this is your first VivaSense analysis."
          />
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {gettingStartedTutorials.map((item) => <TutorialCard key={item.slug} tutorial={item} />)}
          </div>
        </section>

        <section className="border-y border-border bg-muted/35" aria-labelledby="all-guides">
          <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
            <SectionHeading
              icon={BookOpen}
              title="All Practical Guides"
              description="Search the current Early Access help by workflow, design, or task."
            />

            <div className="mt-6 max-w-2xl">
              <label htmlFor="tutorial-search" className="sr-only">Search guides</label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="tutorial-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search CRD, RCBD, split-plot, data capture, reports..."
                  className="pl-9"
                />
              </div>
            </div>

            <Tabs
              value={category}
              onValueChange={(value) => setCategory(value as TutorialCategory | "All")}
              className="mt-5"
            >
              <TabsList
                className="h-auto w-full justify-start gap-1 overflow-x-auto bg-transparent p-0"
                aria-label="Filter help by category"
              >
                <TabsTrigger
                  value="All"
                  className="shrink-0 border border-border bg-background data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  All
                </TabsTrigger>
                {tutorialCategories.map((item) => (
                  <TabsTrigger
                    key={item}
                    value={item}
                    className="shrink-0 border border-border bg-background data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    {item}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <p className="mt-5 text-sm text-muted-foreground" role="status">
              {filteredTutorials.length} guide{filteredTutorials.length === 1 ? "" : "s"} found
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTutorials.map((item) => <TutorialCard key={item.slug} tutorial={item} />)}
            </div>

            {filteredTutorials.length === 0 && (
              <p className="mt-6 rounded-lg border border-dashed border-border bg-background p-6 text-sm text-muted-foreground">
                No guide matches that search. Try a design name such as RCBD, a task such as report, or choose All.
              </p>
            )}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
          <Card className="border-amber-300 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/20">
            <CardContent className="p-5 sm:p-6">
              <h2 className="text-lg font-semibold">Current release boundary</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                CRD and RCBD are Early Access analysis workflows. Factorial CRD, Factorial RCBD, and Split-Plot RCBD
                are Preview · session-only. Download Preview reports before leaving the session. The durable reopen
                pathway currently applies to persistent RCBD AnalysisRuns.
              </p>
            </CardContent>
          </Card>
        </section>
      </main>
    </Layout>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  description
}: {
  icon: typeof BookOpen;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-primary">
        <Icon className="h-5 w-5" aria-hidden="true" />
        <span className="text-sm font-semibold uppercase tracking-wide">VivaSense Help</span>
      </div>
      <h2
        id={title.toLocaleLowerCase().replaceAll(" ", "-")}
        className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl"
      >
        {title}
      </h2>
      <p className="mt-2 max-w-3xl text-muted-foreground">{description}</p>
    </div>
  );
}

function TutorialCard({ tutorial }: { tutorial: (typeof allTutorials)[number] }) {
  return (
    <Card className="flex h-full flex-col transition-shadow hover:shadow-md">
      <CardHeader className="p-5 pb-2">
        <Badge variant="secondary" className="w-fit max-w-full whitespace-normal text-left">
          {tutorial.category}
        </Badge>
        <CardTitle className="mt-3 text-lg">{tutorial.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col p-5 pt-0">
        <CardDescription className="leading-6">{tutorial.description}</CardDescription>
        <Button asChild variant="link" className="mt-4 h-auto justify-start self-start px-0">
          <Link to={"/help/" + tutorial.slug}>Open guide</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
