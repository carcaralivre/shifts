import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  type ErrorComponentProps,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Meus Plantões" },
      { name: "description", content: "Agenda médica e controle de recebimentos." },
      { name: "author", content: "Meus Plantões" },
      { property: "og:title", content: "Meus Plantões" },
      { property: "og:description", content: "Agenda médica e controle de recebimentos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&family=Playfair+Display:wght@500;600;700&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      {
        rel: "apple-touch-icon",
        sizes: "180x180",
        href: "data:image/png;base64,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",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
