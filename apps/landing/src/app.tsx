import { Hero } from "./components/hero";
import { Nav } from "./components/nav";
import {
  AgoraBand,
  Compare,
  Confidence,
  Features,
  FinalCta,
  Footer,
  LinearBand,
  Loop,
  Mcp,
  OpenSource,
  Spotlight,
  Stats,
  StripeBand,
} from "./components/sections";

export function App() {
  return (
    <div className="min-h-svh overflow-x-clip">
      <Nav />
      {/* Bounded page frame; the dotted body grid shows in the gutters.
          Fat rows (image bands, dark section, CTA card) span or break the
          rails; narrow rows keep a text column with filled gutters. */}
      <div className="mx-auto w-full max-w-6xl border-x bg-background">
        <main>
          <Hero />
          <Stats />
          <Loop />
          <AgoraBand />
          <Features />
          <Spotlight />
          <LinearBand />
          <Confidence />
          <Mcp />
          <Compare />
          <StripeBand />
          <OpenSource />
          <StripeBand />
          <FinalCta />
        </main>
        <Footer />
      </div>
    </div>
  );
}
