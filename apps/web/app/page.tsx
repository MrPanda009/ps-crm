'use client';

import Animatedheader from "@/components/Animatedheader";
import FadedText from "@/components/Fadedtext";
import AnimatedText from "@/components/Animatedtext";
import DecorativeLine from "@/components/Decorativeline";
import MapVisual from "@/components/Mapvisual";
import { MegaFooter } from "@/components/MegaFooter";
import { useTheme } from "@/components/ThemeProvider";

export default function HomePage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <main className={`flex min-h-screen flex-col transition-colors duration-500 ${isDark ? "bg-[#2a221c]" : "bg-[#ddd1c0]"}`}>
      <Animatedheader />

      <section className="relative flex min-h-screen items-center px-6 py-16 lg:px-20 lg:py-10">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 lg:flex-row lg:items-center lg:gap-16">
          <div className="relative order-2 w-full lg:order-1 lg:w-1/2">
            <FadedText text="Future" className="absolute -top-8 left-0 text-6xl md:text-8xl lg:text-9xl" />

            <div className="relative z-10 max-w-xl pt-10 lg:pt-16">
              <AnimatedText
                as="h1"
                text="The Centralized Digital Command Center"
                className="text-5xl font-bold tracking-tight md:text-6xl"
              />

              <DecorativeLine width="w-24" className="mt-6" />

              <AnimatedText
                as="p"
                text="Empowering communities with a smart Public Service CRM. Seamlessly organize citizen complaints, automate administrative workflows, and track resolution progress on a live interactive map."
                className="mt-6 max-w-md text-xl leading-relaxed"
                animationDelay={0.35}
              />
            </div>
          </div>

          <div className="order-1 flex w-full items-center justify-center lg:order-2 lg:w-1/2">
            <div className="relative w-full max-w-2xl lg:max-w-lg">
              <div className="absolute -bottom-3 -left-3 h-full w-full rounded-2xl bg-[#5b4238]/40 lg:-bottom-5 lg:-left-5" />
              <MapVisual
                imageSrc="/Image1.jpg"
                className="relative z-10 w-full rounded-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* second full screen page with Empower */}
      <section className="relative flex min-h-screen items-center px-6 py-16 lg:px-20 lg:py-10">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 lg:flex-row lg:items-center lg:gap-16">
          <div className="relative order-1 w-full lg:w-1/2">
            <FadedText text="Empower" className="absolute -top-8 left-0 text-6xl md:text-8xl lg:text-9xl" />
            <div className="relative z-10 pt-10 lg:pt-16">
              <AnimatedText
                as="h2"
                text="Empower Communities"
                className="text-4xl font-bold tracking-tight md:text-5xl"
              />
              <AnimatedText
                as="p"
                text="Give citizens and administrators the tools they need to create lasting impact."
                className="mt-6 max-w-md text-xl leading-relaxed"
                animationDelay={0.2}
              />
            </div>
          </div>
        </div>
      </section>

      {/* third full screen page with Connect */}
      <section className="relative flex min-h-screen items-center px-6 py-16 lg:px-20 lg:py-10">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 lg:flex-row lg:items-center lg:gap-16">
          <div className="relative order-1 w-full lg:w-1/2">
            <FadedText text="Connect" className="absolute -top-8 left-0 text-6xl md:text-8xl lg:text-9xl" />
            <div className="relative z-10 pt-10 lg:pt-16">
              <AnimatedText
                as="h2"
                text="Connect People"
                className="text-4xl font-bold tracking-tight md:text-5xl"
              />
              <AnimatedText
                as="p"
                text="Bridge the gap between citizens and services through real-time communication and data."
                className="mt-6 max-w-md text-xl leading-relaxed"
                animationDelay={0.2}
              />
            </div>
          </div>
        </div>
      </section>

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
