'use client';

import Animatedheader from "@/components/Animatedheader";
import FadedText from "@/components/Fadedtext";
import AnimatedText from "@/components/Animatedtext";
import DecorativeLine from "@/components/Decorativeline";
import { MegaFooter } from "@/components/MegaFooter";

export default function HomePage() {
  return (
    // the entire page is wrapped in <main>
    <main className="flex flex-col min-h-screen bg-[#ddd1c0]">
      {/* header can remain here or be moved outside if you prefer */}
      <Animatedheader />

      {/* first full‑screen section (hero) */}
      <section className="relative min-h-screen flex flex-col items-start justify-start pt-20 px-8 lg:px-20">
        {/* content aligned to left with padding */}
        <FadedText text="PS‑CRM" className="text-9xl" />

        <AnimatedText
          as="h1"
          text="Manage city resources efficiently"
          className="text-5xl font-bold mt-4"
        />

        <DecorativeLine width="w-24" className="mt-2" />
      </section>

      {/* additional full‑screen sections can be added here */}
      <section className="min-h-screen">
        {/* placeholder for future content (map, cards, etc.) */}
      </section>

      {/* …more <section> elements as the page grows… */}

      <MegaFooter
        brandColor="#000000"
        brandColorDark="#ffffff"
        newsletterTitleColor="#000000"
        newsletterTitleColorDark="#ffffff"
        brandName="Bits"
        tagline="Designing delightful digital experiences."
        socialLinks={[
          { platform: "twitter", href: "https://twitter.com" },
          { platform: "github", href: "https://github.com/Medhansh-741/ps-crm" },
          { platform: "linkedin", href: "https://linkedin.com" },
        ]}
        showNewsletter={true}
        newsletterTitle="Stay updated"
        newsletterPlaceholder="Enter your email"
      />
    </main>
  );
}
