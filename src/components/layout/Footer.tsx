import { Link } from "react-router-dom";
import { FlaskConical, Mail } from "lucide-react";

interface FooterProps {
  variant?: "default" | "minimal-vivasense";
}

export function Footer({ variant = "minimal-vivasense" }: FooterProps) {
  if (variant === "minimal-vivasense") {
    return (
      <footer className="bg-primary text-primary-foreground mt-12">
        <div className="container-wide py-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 border-b border-primary-foreground/15 pb-8">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-9 h-9 rounded-md bg-primary-foreground/10 flex items-center justify-center">
                  <FlaskConical className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="font-serif font-semibold text-base text-primary-foreground">VivaSense</span>
              </div>
              <p className="text-xs leading-relaxed text-primary-foreground/80">
                Statistical analytics platform for agricultural research workflows.
              </p>
              <a
                href="mailto:info@fieldtoinsightacademy.com.ng"
                className="inline-flex items-center gap-1.5 mt-3 text-xs text-primary-foreground/90 hover:text-primary-foreground transition-colors"
              >
                <Mail className="w-3 h-3" />
                info@fieldtoinsightacademy.com.ng
              </a>
            </div>

            <div>
              <h5 className="font-semibold text-sm mb-3 text-primary-foreground">Field-to-Insight Academy</h5>
              <p className="text-xs text-primary-foreground/80 leading-relaxed">
                Built and maintained as long-term academic research infrastructure.
              </p>
              <p className="text-xs text-primary-foreground/70 mt-3">
                For institutional licensing inquiries, please <Link to="/contact" className="underline hover:text-primary-foreground">contact us</Link>.
              </p>
            </div>

            <div>
              <h5 className="font-semibold text-sm mb-3 text-primary-foreground">Resources</h5>
              <ul className="space-y-2 text-xs">
                <li>
                  <a href="https://fieldtoinsightacademy.com.ng" target="_blank" rel="noopener noreferrer" className="text-primary-foreground/80 hover:text-primary-foreground transition-colors">
                    Institution Site
                  </a>
                </li>
                <li>
                  <Link to="/workspace" className="text-primary-foreground/80 hover:text-primary-foreground transition-colors">
                    Launch Workspace
                  </Link>
                </li>
                <li>
                  <a href="mailto:support@vivasense.app" className="text-primary-foreground/80 hover:text-primary-foreground transition-colors">
                    Support
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row justify-between items-center gap-2 text-[11px] text-primary-foreground/70">
            <p>© {new Date().getFullYear()} VivaSense · Field-to-Insight Academy</p>
            <p>Built for transparent, reproducible agricultural research</p>
          </div>
        </div>
      </footer>
    );
  }

  // Default variant (full FIA footer) - not used in standalone, but available
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container-wide py-12">
        <p className="text-center text-sm text-primary-foreground/80">
          VivaSense by Field-to-Insight Academy · {new Date().getFullYear()}
        </p>
      </div>
    </footer>
  );
}
