import * as Sentry from "@sentry/nextjs";

const tracesSampleRate = process.env.NODE_ENV === "production" ? 0.1 : 1.0;

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate,
  sendDefaultPii: false,
  beforeSend(event) {
    if (event.user) {
      event.user = event.user.id ? { id: event.user.id } : undefined;
    }
    return event;
  },
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.category === "ui.input") {
      return null;
    }

    if (breadcrumb.category === "fetch" || breadcrumb.category === "xhr") {
      return null;
    }

    return breadcrumb;
  },
});