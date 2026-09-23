import { Connect } from "@/components/connect";
import { CTA } from "@/components/cta";
import { DivideX } from "@/components/divide";
import { FAQs } from "@/components/faqs";
import { Hero } from "@/components/hero";
import { HeroCode } from "@/components/hero-code";
import { HowItWorks } from "@/components/how-it-works";
import { NetworkBand } from "@/components/network-band";
import { Numbers } from "@/components/numbers";
import { Tools } from "@/components/tools";
import { TryIt } from "@/components/try-it";

import { getSEOTags } from "@/lib/seo";

export const metadata = getSEOTags();

const tryItEnabled = process.env.NEXT_PUBLIC_TRY_IT === "true";

export default function Home() {
  return (
    <main>
      <DivideX />
      <Hero />
      <DivideX />
      <HeroCode />
      <DivideX />
      <NetworkBand />
      <DivideX />
      <HowItWorks />
      <DivideX />
      <Tools />
      <DivideX />
      {tryItEnabled && (
        <>
          <TryIt />
          <DivideX />
        </>
      )}
      <Numbers />
      <DivideX />
      <Connect />
      <DivideX />
      <FAQs />
      <DivideX />
      <CTA />
      <DivideX />
    </main>
  );
}
