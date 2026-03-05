'use client';

import { MegaFooter } from "@/components/MegaFooter";
import AnimatedAuth from "@/components/AnimatedAuth";

export default function LoginPage() {
  return (
    <div className="flex flex-col min-h-screen ">
        <main>
      <AnimatedAuth 
        themeColor="#b58d80"
        themeColorDark="#8c6a5d"
        glowColor="rgba(32, 10, 8, 0.46)"
        glowColorDark="rgba(16, 5, 4, 0.6)"
        transitionTintColor="#d2b48c"
        transitionTintColorDark="#2c241b"
        backgroundColor="#d2b48c"
        backgroundColorDark="#2c241b"
        backdrop="#ad7777"
        backdropDark="#1f1515"
        placeholderColor="rgb(0, 0, 0)"
        placeholderColorDark="rgba(255, 255, 255, 1)"
        leftPanelSubtitle = 'Lorem ipsum dolor sit amet consectetur adipisicing.'
        leftPanelTitle="STAY CONNECTED!"
        rightPanelTitle = 'HELLO FRIEND!'
        rightPanelSubtitle = 'Enter your personal details and start your journey with us.'
        leftPanelImage = 'Image1.jpg'
        rightPanelImage = 'Image2.jpg'
      />
      </main>
      <MegaFooter
        brandName="Bits"
        tagline="Designing delightful digital experiences."
        socialLinks={[
          { platform: "twitter", href: "https://twitter.com" },
          { platform: "github", href: "https://github.com/Medhansh-741/ps-crm"},
          { platform: "linkedin", href: "https://linkedin.com" },
        ]}
        showNewsletter={true}
        newsletterTitle="Stay updated"
        newsletterPlaceholder="Enter your email"
      />
    </div>
  );
}