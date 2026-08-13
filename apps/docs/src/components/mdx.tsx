import defaultMdxComponents from "fumadocs-ui/mdx";
import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import {
  Blocks,
  Bot,
  Braces,
  Building2,
  CalendarDays,
  CloudUpload,
  Inbox,
  IdCard,
  Mail,
  Megaphone,
  PanelRight,
  Plug,
  Presentation,
  Rocket,
  Scale,
  Signpost,
  Users,
} from "lucide-react";
import type { MDXComponents } from "mdx/types";

export function getMDXComponents(components?: MDXComponents) {
  return {
    // Card/Cards/Callout ship with the defaults; the rest are opt-in.
    ...defaultMdxComponents,
    Accordion,
    Accordions,
    Step,
    Steps,
    Tab,
    Tabs,
    // Icons for MDX card grids (fumadocs Card renders them as icon tiles).
    Blocks,
    Bot,
    Braces,
    Building2,
    CalendarDays,
    CloudUpload,
    Inbox,
    IdCard,
    Mail,
    Megaphone,
    PanelRight,
    Plug,
    Presentation,
    Rocket,
    Scale,
    Signpost,
    Users,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
