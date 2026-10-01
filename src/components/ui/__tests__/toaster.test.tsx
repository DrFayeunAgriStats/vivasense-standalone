import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Toaster } from "@/components/ui/toaster";
import { toast } from "@/hooks/use-toast";

describe("application toast renderer", () => {
  it("renders errors emitted through the shared useToast store", async () => {
    render(<Toaster />);
    toast({
      title: "ANOVA failed",
      description: "Example backend failure",
      variant: "destructive",
    });

    expect(await screen.findByText("ANOVA failed")).toBeInTheDocument();
    expect(await screen.findByText("Example backend failure")).toBeInTheDocument();
  });
});
