import { Hero } from "./components/hero";
import { Nav } from "./components/nav";
import {
  Compare,
  DotBand,
  Features,
  FinalCta,
  Footer,
  GardenBand,
  Loop,
  OpenSource,
  Stats,
} from "./components/sections";

export function App() {
  return (
    <div className="min-h-svh overflow-x-clip">
      <Nav />
      {/* Bounded page frame; the dotted body grid shows in the gutters.
          Image bands break out of the rails at full viewport width. */}
      <div className="mx-auto w-full max-w-6xl border-x bg-background">
        <main>
          <Hero />
          <Stats />
          <DotBand />
          <Loop />
          <Features />
          <GardenBand />
          <Compare />
          <DotBand />
          <OpenSource />
          <FinalCta />
        </main>
        <Footer />
      </div>
    </div>
  );
}
